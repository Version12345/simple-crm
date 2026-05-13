import { AppDataSource } from "./data-source";
import { Lead } from "./entity/Lead";
import { CustomField } from "./entity/CustomField";
import { Stage } from "./entity/Stage";
import { Opportunity } from "./entity/Opportunity";
import { AppSetting } from "./entity/AppSetting";

/** Returns a random "YYYY-MM-DD" string in the half-open range [start, end). */
function randomDate(start: Date, end: Date): string {
    const t = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const firstNames = ["John", "Jane", "Bob", "Alice", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Iris", "Jack", "Karen", "Leo", "Megan", "Nathan", "Olivia", "Peter", "Quinn", "Rachel"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson", "Taylor", "Thomas", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson"];

const dealNames = ["Enterprise Deal", "Mid-Market Contract", "SMB Package", "Consulting Services", "Software License", "Support Plan", "Integration Project", "Custom Development"];
const industries = ["Healthcare", "Finance", "Retail", "Manufacturing", "Tech"];
const regionValues = ["NA", "EMEA", "APAC", "na", "North America", ""];

export async function seedDatabase({ clearFirst = false }: { clearFirst?: boolean } = {}) {
    const connection = AppDataSource;

    if (clearFirst) {
        await connection.manager.getRepository(Opportunity).createQueryBuilder().delete().execute();
        await connection.manager.getRepository(Lead).createQueryBuilder().delete().execute();
        await connection.manager.getRepository(Stage).createQueryBuilder().delete().execute();
        await connection.manager.getRepository(AppSetting).createQueryBuilder().delete().execute();
        await connection.manager.getRepository(CustomField).createQueryBuilder().delete().execute();
    } else {
        const existingStages = await connection.manager.getRepository(Stage).count();
        if (existingStages > 0) {
            // Patch: correct the entity values for the three seeded custom fields.
            // If the DB was created before entity values were made explicit (when the
            // column defaulted to "lead" for everything), region and headcount will
            // have the wrong entity and won't appear in the Forecast group-by dropdown.
            const cfRepo = connection.manager.getRepository(CustomField);
            const entityPatches: Array<{ name: string; entity: string }> = [
                { name: "industry",  entity: "lead" },
                { name: "region",    entity: "opportunity" },
                { name: "headcount", entity: "opportunity" },
            ];
            for (const { name, entity } of entityPatches) {
                await cfRepo
                    .createQueryBuilder()
                    .update()
                    .set({ entity })
                    .where("name = :name AND entity != :entity", { name, entity })
                    .execute();
            }
            console.log("Database already has data; skipping seed. Run `npm run seed` to reset.");
            return;
        }
    }

    const defaultSettings = [
        { key: "wonStageLikelihood", value: "1.0" },
        { key: "lostStageLikelihood", value: "0.0" },
        { key: "minimumOpportunityValue", value: "1000" },
        { key: "defaultStageConversionLikelihood", value: "0.5" },
    ];
    await connection.manager.getRepository(AppSetting).save(
        defaultSettings.map(s => Object.assign(new AppSetting(), s))
    );
    console.log(`✓ Created ${defaultSettings.length} app settings`);

    const customFieldsData = [
        { name: "industry", label: "Industry", entity: "lead", type: "text" },
        { name: "region", label: "Region", entity: "opportunity", type: "text" },
        { name: "headcount", label: "Headcount", entity: "opportunity", type: "number" },
    ];
    await connection.manager.getRepository(CustomField).save(
        customFieldsData.map(f => Object.assign(new CustomField(), f))
    );
    console.log(`✓ Created ${customFieldsData.length} custom fields`);

    const stagesData = [
        { name: "Cold Lead", status: "pending" as const, conversionLikelihood: 0.05, order: 1 },
        { name: "Warm Lead", status: "pending" as const, conversionLikelihood: 0.15, order: 2 },
        { name: "First Contact", status: "pending" as const, conversionLikelihood: 0.3, order: 3 },
        { name: "Completed Demo", status: "pending" as const, conversionLikelihood: 0.5, order: 4 },
        { name: "Negotiation", status: "pending" as const, conversionLikelihood: 0.7, order: 5 },
        { name: "Deal Signed", status: "won" as const, conversionLikelihood: 1.0, order: 6 },
        { name: "Ghosted Me", status: "lost" as const, conversionLikelihood: 0.0, order: 7 },
    ];

    const stages = await connection.manager.getRepository(Stage).save(
        stagesData.map(s => Object.assign(new Stage(), s))
    );

    console.log(`✓ Created ${stages.length} stages`);

    const leads: Lead[] = [];
    for (let i = 0; i < 20; i++) {
        const lead = new Lead();
        lead.firstName = firstNames[i % firstNames.length];
        lead.lastName = lastNames[i % lastNames.length];
        lead.age = Math.floor(Math.random() * 40) + 25;
        lead.phoneNumber = `555-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
        lead.customFields = i % 3 === 0 ? {} : { industry: industries[i % industries.length] };
        leads.push(await connection.manager.getRepository(Lead).save(lead));
    }

    console.log(`✓ Created ${leads.length} leads`);

    // Close-date ranges relative to the seed run date.
    //   bucket 0 (25%) — before current month : [1 year ago, start of current month)
    //   bucket 1 (25%) — current month        : [start of month, start of next month)
    //   bucket 2 (25%) — after current month  : [start of next month, 1 year ahead)
    //   bucket 3 (25%) — no close date        : null
    const now = new Date();
    const monthStart  = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const oneYearAgo  = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneYearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    let oppCount = 0;
    for (const lead of leads) {
        const numOpps = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < numOpps; i++) {
            const opp = new Opportunity();
            opp.lead = lead;
            opp.stage = stages[Math.floor(Math.random() * stages.length)];
            opp.value = Math.floor(Math.random() * 95000) + 5000;
            opp.name = dealNames[Math.floor(Math.random() * dealNames.length)];
            const region = regionValues[Math.floor(Math.random() * regionValues.length)];
            const rawHeadcount = Math.floor(Math.random() * 500) + 10;
            opp.customFields = {
                region,
                headcount: oppCount % 2 === 0 ? rawHeadcount : String(rawHeadcount),
            };
            // Distribute close dates evenly across the four buckets.
            const bucket = oppCount % 4;
            opp.closeDate =
                bucket === 0 ? randomDate(oneYearAgo, monthStart)  // before current month
              : bucket === 1 ? randomDate(monthStart, nextMonth)    // current month
              : bucket === 2 ? randomDate(nextMonth, oneYearAhead)  // after current month
              : null;                                                // no close date
            const likelihood =
                opp.stage.status === "won" ? 1.0 : opp.stage.status === "lost" ? 0.0 : opp.stage.conversionLikelihood;
            opp.expectedValue = opp.value * likelihood;
            await connection.manager.getRepository(Opportunity).save(opp);
            oppCount++;
        }
    }

    console.log(`✓ Created ${oppCount} opportunities`);

    for (const stage of stages) {
        const stageOpps = await connection.manager.getRepository(Opportunity).find({ where: { stage: { id: stage.id } } });
        stage.expectedValue = stageOpps.reduce((sum, opp) => sum + (opp.expectedValue || 0), 0);
        await connection.manager.getRepository(Stage).save(stage);
    }

    console.log("✓ Seeding complete!");
}

if (require.main === module) {
    AppDataSource.initialize()
        .then(async () => {
            await seedDatabase({ clearFirst: true });
            await AppDataSource.destroy();
        })
        .catch(err => {
            console.error("Seed error:", err);
            process.exit(1);
        });
}
