import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Opportunity } from "./Opportunity";

@Entity()
export class Stage {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    status: "pending" | "won" | "lost";

    @Column("real")
    conversionLikelihood: number;

    @Column()
    order: number;

    @Column("real", { default: 0 })
    expectedValue: number;

    @OneToMany(() => Opportunity, opportunity => opportunity.stage)
    opportunities: Opportunity[];
}
