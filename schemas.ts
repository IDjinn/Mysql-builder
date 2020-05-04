import { Connection } from "mysql";
import NoSQLMysql from ".";
import { Collection } from "discord.js";
import { writeFileSync, readdir, unlink } from "fs";
import { join } from "path";

export enum KeyType {
    PRIMARY_KEY,
    UNIQUE,
    KEY,
    NONE
}

export enum ExtraType {
    AUTO_INCREMENT,
    NONE
}

export interface IField {
    field: string;
    type: any;
    null: boolean;
    key: KeyType | null;
    default: number | string | null;
    extra: ExtraType | null;
}

export default class SchemasConstructor {
    private nosql: NoSQLMysql;
    private tables: Collection<string, IField[]>;
    private pattern: RegExp = RegExp(/(\w+)\((\w+)\)/, 'g');
    private path: string;

    constructor(nosql: NoSQLMysql, path: string) {
        this.tables = new Collection();
        this.nosql = nosql;
        this.path = path;
        this.clearDir();

        this.nosql.runQuery('SHOW TABLES').then(async (rows: any) => {
            this.prepareAndWriteTables(rows);
        });
    }

    private clearDir() {
        readdir(this.path, (err, files) => {
            for (const file of files)
                unlink(join(this.path, file), () => { });
        });
    }

    private prepareAndWriteTables(tables: any) {
        tables.map((row: any) => {
            Object.values(row).map((table: any) => {
                this.nosql.runQuery(`DESC \`${table}\``).then(async (fields: any) => {
                    const json = await fields.map((field: any) => ({
                        field: field.Field,
                        type: this.parseType(field.Type),
                        null: field.Null === "YES",
                        key: this.parseKeyType(field.Key),
                        default: field.Default,
                        extra: this.parseExtra(field.Extra)
                    }));
                    writeFileSync(`${__dirname}/schemas/${table}.json`, JSON.stringify(json, null, 2), 'utf-8')
                });
            });
        });
    }

    private parseType(str: string) {
        const match = this.pattern.exec(str);
        if (match) {
            switch (match[1].toLowerCase()) {
                case 'int':
                case 'double':
                    return Number;
                case 'varchar':
                case 'char':
                    return String;
            }
        }
        return str;
    }

    private parseKeyType(str: string) {
        switch (str.toLowerCase()) {
            case 'PRI':
                return KeyType.PRIMARY_KEY;
            case 'UNI':
                return KeyType.UNIQUE;
            case 'KEY':
                return KeyType.KEY;
            default:
                return KeyType.NONE;
        }
    }

    private parseExtra(str: string) {
        switch (str.toLowerCase()) {
            case 'auto_increment':
                return ExtraType.AUTO_INCREMENT;
            default:
                return ExtraType.NONE;
        }
    }
}