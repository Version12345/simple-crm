import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity()
export class AppSetting {
    @PrimaryColumn()
    key: string;

    @Column()
    value: string;
}
