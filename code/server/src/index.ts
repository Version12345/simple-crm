import { AppDataSource } from "./data-source";
import { Lead } from "./entity/Lead";
import { CustomField } from "./entity/CustomField";
import { Stage } from "./entity/Stage";
import { Opportunity } from "./entity/Opportunity";
import { AppSetting } from "./entity/AppSetting";
import { seedDatabase } from "./seed";
import { computeForecast } from "./forecast-helpers";
import * as express from "express";

const run = async () => {
    await AppDataSource.initialize();
    await seedDatabase();
    const app = express();
    app.use(express.json());

    // Settings endpoints
    app.get("/settings", async (req, res) => {
        const settings = await AppDataSource.manager.getRepository(AppSetting).find();
        res.json(settings);
    });

    app.put("/settings/:key", async (req, res) => {
        const setting = await AppDataSource.manager.getRepository(AppSetting).findOne({ where: { key: req.params.key } });
        if (!setting) {
            const created = new AppSetting();
            created.key = req.params.key;
            created.value = req.body.value;
            await AppDataSource.manager.getRepository(AppSetting).save(created);
            res.json(created);
            return;
        }
        setting.value = req.body.value;
        await AppDataSource.manager.getRepository(AppSetting).save(setting);

        if (setting.key === "wonStageLikelihood" || setting.key === "lostStageLikelihood") {
            const status = setting.key === "wonStageLikelihood" ? "won" : "lost";
            const newLikelihood = parseFloat(setting.value);
            const stagesRepo = AppDataSource.manager.getRepository(Stage);
            const oppsRepo = AppDataSource.manager.getRepository(Opportunity);
            const stages = await stagesRepo.find({ where: { status } });
            for (const stage of stages) {
                const stageOpps = await oppsRepo.find({ where: { stage: { id: stage.id } } });
                stage.expectedValue = stageOpps.reduce((sum, opp) => sum + opp.value * newLikelihood, 0);
                await stagesRepo.save(stage);
            }
        }

        res.json(setting);
    });

    // Custom Fields endpoints
    app.get("/custom-fields", async (req, res) => {
        const fields = await AppDataSource.manager.getRepository(CustomField).find();
        res.json(fields);
    });

    app.post("/custom-fields", async (req, res) => {
        const field = new CustomField();
        field.name = req.body.name;
        field.label = req.body.label;
        if (req.body.entity) field.entity = req.body.entity;
        if (req.body.type) field.type = req.body.type;
        try {
            await AppDataSource.manager.getRepository(CustomField).save(field);
            res.json(field);
        } catch (error) {
            res.status(400).json({ error: "Field name already exists" });
        }
    });

    app.delete("/custom-fields/:id", async (req, res) => {
        await AppDataSource.manager.getRepository(CustomField).delete(req.params.id);
        res.json({ success: true });
    });

    // Leads endpoints
    app.get("/leads", async (req, res) => {
        const leads = await AppDataSource.manager.getRepository(Lead).find();
        res.json(leads);
    });

    app.post("/leads", async (req, res) => {
        const lead = new Lead();
        lead.firstName = req.body.firstName;
        lead.lastName = req.body.lastName;
        lead.age = req.body.age;
        lead.phoneNumber = req.body.phoneNumber;
        lead.customFields = req.body.customFields || {};
        await AppDataSource.manager.getRepository(Lead).save(lead);
        res.json(lead);
    });

    app.put("/leads/:id", async (req, res) => {
        const lead = await AppDataSource.manager
            .getRepository(Lead)
            .findOne({ where: { id: parseInt(req.params.id) } });
        lead.firstName = req.body.firstName;
        lead.lastName = req.body.lastName;
        lead.age = req.body.age;
        lead.phoneNumber = req.body.phoneNumber;
        lead.customFields = req.body.customFields || {};
        await AppDataSource.manager.getRepository(Lead).save(lead);
        res.json(lead);
    });

    app.delete("/leads/:id", async (req, res) => {
        const leadId = parseInt(req.params.id);
        const oppRepo = AppDataSource.manager.getRepository(Opportunity);
        const stageRepo = AppDataSource.manager.getRepository(Stage);

        // Load all opportunities so we can unwind the stage denormalized totals.
        // eager: true on the stage relation means each opp comes back with its stage.
        const opps = await oppRepo.find({ where: { lead: { id: leadId } } });
        for (const opp of opps) {
            opp.stage.expectedValue = (opp.stage.expectedValue ?? 0) - (opp.expectedValue ?? 0);
            await stageRepo.save(opp.stage);
        }

        // Delete the opportunities, then the lead.
        if (opps.length > 0) {
            await oppRepo.delete(opps.map(o => o.id));
        }
        await AppDataSource.manager.getRepository(Lead).delete(leadId);
        res.json({ success: true });
    });

    // Stages endpoints
    app.get("/stages", async (req, res) => {
        const stages = await AppDataSource.manager.getRepository(Stage).find({ order: { order: "ASC" } });
        res.json(stages);
    });

    app.post("/stages", async (req, res) => {
        const stage = new Stage();
        stage.name = req.body.name;
        stage.status = req.body.status;
        stage.conversionLikelihood = req.body.conversionLikelihood;
        const maxOrder = await AppDataSource.manager
            .getRepository(Stage)
            .createQueryBuilder("stage")
            .select("MAX(stage.order)", "max")
            .getRawOne();
        stage.order = (maxOrder.max || 0) + 1;
        await AppDataSource.manager.getRepository(Stage).save(stage);
        res.json(stage);
    });

    app.put("/stages/:id", async (req, res) => {
        const stage = await AppDataSource.manager.getRepository(Stage).findOne({ where: { id: parseInt(req.params.id) } });
        stage.name = req.body.name;
        stage.status = req.body.status;
        stage.conversionLikelihood = req.body.conversionLikelihood;
        if (req.body.order !== undefined) stage.order = req.body.order;
        await AppDataSource.manager.getRepository(Stage).save(stage);
        res.json(stage);
    });

    app.delete("/stages/:id", async (req, res) => {
        await AppDataSource.manager.getRepository(Stage).delete(req.params.id);
        res.json({ success: true });
    });

    // Opportunities endpoints
    app.get("/opportunities", async (req, res) => {
        const repo = AppDataSource.manager.getRepository(Opportunity);
        if (req.query.leadId !== undefined) {
            const leadId = parseInt(req.query.leadId as string, 10);
            const opportunities = await repo.find({ where: { lead: { id: leadId } } });
            res.json(opportunities);
            return;
        }
        const opportunities = await repo.find();
        res.json(opportunities);
    });

    app.post("/opportunities", async (req, res) => {
        const settings = await AppDataSource.manager.getRepository(AppSetting).find();
        const minValue = parseFloat(settings.find(s => s.key === "minimumOpportunityValue")?.value ?? "0");
        const wonLikelihood = parseFloat(settings.find(s => s.key === "wonStageLikelihood")?.value ?? "1");
        const lostLikelihood = parseFloat(settings.find(s => s.key === "lostStageLikelihood")?.value ?? "0");

        if (req.body.value < minValue) {
            res.status(400).json({ error: `Value must be at least ${minValue}` });
            return;
        }

        const opp = new Opportunity();
        opp.lead = await AppDataSource.manager.getRepository(Lead).findOne({ where: { id: req.body.leadId } });
        opp.stage = await AppDataSource.manager.getRepository(Stage).findOne({ where: { id: req.body.stageId } });
        opp.value = req.body.value;
        opp.name = req.body.name;
        opp.closeDate = req.body.closeDate ?? null;
        opp.customFields = req.body.customFields || {};
        const likelihood =
            opp.stage.status === "won" ? wonLikelihood : opp.stage.status === "lost" ? lostLikelihood : opp.stage.conversionLikelihood;
        opp.expectedValue = opp.value * likelihood;
        await AppDataSource.manager.getRepository(Opportunity).save(opp);

        opp.stage.expectedValue = (opp.stage.expectedValue || 0) + opp.expectedValue;
        await AppDataSource.manager.getRepository(Stage).save(opp.stage);

        res.json(opp);
    });

    app.put("/opportunities/:id", async (req, res) => {
        const settings = await AppDataSource.manager.getRepository(AppSetting).find();
        const minValue = parseFloat(settings.find(s => s.key === "minimumOpportunityValue")?.value ?? "0");
        const wonLikelihood = parseFloat(settings.find(s => s.key === "wonStageLikelihood")?.value ?? "1");
        const lostLikelihood = parseFloat(settings.find(s => s.key === "lostStageLikelihood")?.value ?? "0");

        const opp = await AppDataSource.manager.getRepository(Opportunity).findOne({ where: { id: parseInt(req.params.id) } });
        const oldExpectedValue = opp.expectedValue || 0;
        const oldStage = opp.stage;
        if (req.body.stageId) opp.stage = await AppDataSource.manager.getRepository(Stage).findOne({ where: { id: req.body.stageId } });
        if (req.body.value !== undefined) {
            if (req.body.value < minValue) {
                res.status(400).json({ error: `Value must be at least ${minValue}` });
                return;
            }
            opp.value = req.body.value;
        }
        if (req.body.name !== undefined) opp.name = req.body.name;
        if (req.body.closeDate !== undefined) opp.closeDate = req.body.closeDate ?? null;
        if (req.body.customFields) opp.customFields = req.body.customFields;
        const likelihood =
            opp.stage.status === "won" ? wonLikelihood : opp.stage.status === "lost" ? lostLikelihood : opp.stage.conversionLikelihood;
        opp.expectedValue = opp.value * likelihood;
        await AppDataSource.manager.getRepository(Opportunity).save(opp);

        if (oldStage.id !== opp.stage.id) {
            oldStage.expectedValue = (oldStage.expectedValue || 0) - oldExpectedValue;
            await AppDataSource.manager.getRepository(Stage).save(oldStage);
            opp.stage.expectedValue = (opp.stage.expectedValue || 0) + opp.expectedValue;
            await AppDataSource.manager.getRepository(Stage).save(opp.stage);
        } else {
            opp.stage.expectedValue = (opp.stage.expectedValue || 0) - oldExpectedValue + opp.expectedValue;
            await AppDataSource.manager.getRepository(Stage).save(opp.stage);
        }

        res.json(opp);
    });

    app.delete("/opportunities/:id", async (req, res) => {
        const opp = await AppDataSource.manager.getRepository(Opportunity).findOne({ where: { id: parseInt(req.params.id) } });
        if (opp) {
            opp.stage.expectedValue = (opp.stage.expectedValue || 0) - (opp.expectedValue || 0);
            await AppDataSource.manager.getRepository(Stage).save(opp.stage);
            await AppDataSource.manager.getRepository(Opportunity).delete(req.params.id);
        }
        res.json({ success: true });
    });

    // Forecast report endpoint
    app.get("/forecast", async (req, res) => {
        const opportunities = await AppDataSource.manager
            .getRepository(Opportunity)
            .createQueryBuilder("opp")
            .leftJoinAndSelect("opp.lead", "lead")
            .leftJoinAndSelect("opp.stage", "stage")
            .getMany();
        const groupBy = typeof req.query.groupBy === "string" && req.query.groupBy ? req.query.groupBy : null;
        res.json(computeForecast(opportunities, new Date(), groupBy));
    });

    // Pipeline report endpoint
    app.get("/pipeline", async (req, res) => {
        const stages = await AppDataSource.manager.getRepository(Stage).find({ order: { order: "ASC" } });
        const opportunities = await AppDataSource.manager.getRepository(Opportunity).find();

        let totalValue = 0;
        let expectedValue = 0;

        const byStage = stages.map(stage => {
            const stageOpps = opportunities.filter(opp => opp.stage.id === stage.id);
            const stageTotal = stageOpps.reduce((sum, opp) => sum + opp.value, 0);
            const stageExpected = stageOpps.reduce((sum, opp) => sum + (opp.expectedValue ?? 0), 0);

            totalValue += stageTotal;
            expectedValue += stageExpected;

            return {
                stage,
                count: stageOpps.length,
                totalValue: stageTotal,
                expectedValue: stageExpected,
            };
        });

        res.json({ totalValue, expectedValue, byStage });
    });

    // Kanban board endpoint
    app.get("/kanban", async (req, res) => {
        const stages = await AppDataSource.manager
            .getRepository(Stage)
            .find({ order: { order: "ASC" } });

        // Sort by user-defined order first; fall back to id for ties (e.g. on first load)
        const opportunities = await AppDataSource.manager
            .getRepository(Opportunity)
            .find({ order: { order: "ASC", id: "ASC" } });

        const columns = stages.map(stage => {
            const stageOpps = opportunities.filter(opp => opp.stage.id === stage.id);
            return {
                id: stage.id,
                name: stage.name,
                status: stage.status,
                order: stage.order,
                opportunities: stageOpps.map(opp => ({
                    id: opp.id,
                    name: opp.name ?? null,
                    status: opp.stage.status,
                    expectedValue: opp.expectedValue ?? 0,
                    closeDate: opp.closeDate ?? null,
                })),
            };
        });

        res.json({ columns });
    });

    // Kanban reorder endpoint — persists card order (and stage) after any drag
    // Body: { columns: { stageId: number; opportunityIds: number[] }[] }
    // Each column entry lists its opportunity ids in the desired display order.
    // For within-column drags only `order` is updated.
    // For cross-column drags `stage`, `expectedValue`, and stage denorm totals are also updated.
    app.patch("/kanban/reorder", async (req, res) => {
        const columns: { stageId: number; opportunityIds: number[] }[] = req.body.columns;

        const settings = await AppDataSource.manager.getRepository(AppSetting).find();
        const wonLikelihood = parseFloat(settings.find(s => s.key === "wonStageLikelihood")?.value ?? "1");
        const lostLikelihood = parseFloat(settings.find(s => s.key === "lostStageLikelihood")?.value ?? "0");

        const oppRepo = AppDataSource.manager.getRepository(Opportunity);
        const stageRepo = AppDataSource.manager.getRepository(Stage);

        for (const col of columns) {
            const newStage = await stageRepo.findOne({ where: { id: col.stageId } });
            if (!newStage) continue;

            for (let i = 0; i < col.opportunityIds.length; i++) {
                const opp = await oppRepo.findOne({ where: { id: col.opportunityIds[i] } });
                if (!opp) continue;

                opp.order = i;

                if (opp.stage.id !== col.stageId) {
                    // Cross-column move — recalculate expectedValue and update stage denorm totals
                    const oldStage = opp.stage;
                    const oldExpectedValue = opp.expectedValue ?? 0;

                    const likelihood = newStage.status === "won" ? wonLikelihood
                        : newStage.status === "lost" ? lostLikelihood
                        : newStage.conversionLikelihood;
                    const newExpectedValue = opp.value * likelihood;

                    oldStage.expectedValue = (oldStage.expectedValue ?? 0) - oldExpectedValue;
                    await stageRepo.save(oldStage);

                    newStage.expectedValue = (newStage.expectedValue ?? 0) + newExpectedValue;
                    await stageRepo.save(newStage);

                    opp.stage = newStage;
                    opp.expectedValue = newExpectedValue;
                }

                await oppRepo.save(opp);
            }
        }

        res.json({ success: true });
    });

    app.listen(3000, () => {
        console.log("Server is running on http://localhost:3000");
    });
};

run();
