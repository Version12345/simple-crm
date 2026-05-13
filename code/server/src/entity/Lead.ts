import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { Opportunity } from "./Opportunity";

@Entity()
export class Lead {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    firstName: string;

    @Column()
    lastName: string;

    @Column()
    age: number;

    @Column()
    phoneNumber: string;

    @Column("simple-json", { nullable: true })
    customFields: Record<string, string> = {};

    @OneToMany(() => Opportunity, opportunity => opportunity.lead)
    opportunities: Opportunity[];
}
