import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity()
export class CustomField {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    name: string;

    @Column()
    label: string;

    @Column({ default: "opportunity" })
    entity: string;

    @Column({ default: "text" })
    type: string;
}
