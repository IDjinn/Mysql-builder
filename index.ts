import { createConnection, ConnectionConfig, Connection, MysqlError } from "mysql";
import { isArray } from "util";
import SchemasConstructor from "./schemas";

const TIMEOUT = 2500;

enum Operator {
  WHERE,
  AND,
  OR,
  IN
}

enum Condition {
  EQUAL
}

enum Command {
  SELECT,
  DELETE,
  UPDATE,
  CREATE,
  DROP
}

interface IQuery {
  command: Command;
  tables: Array<string>;
  column: Array<string> | "*";
  conditions: ICondition[];
}

interface ICondition {
  column: string;
  condition: Condition;
  value: any;
  operator: Operator;
}

class Query implements IQuery {
  command: Command;
  tables: string[] = [];
  column: string[] = [];
  conditions: ICondition[] = [];
  connection: Connection;

  constructor(command: Command, connection: Connection) {
    this.command = command;
    this.connection = connection;
  }

  private separator(strings: Array<string>) {
    let array = isArray(strings) ? strings : [strings];
    if (array.length > 0) {
      array = array.map(str => `\`${str}\``);
    }
    return array.join(", ");
  }

  public from(tables: Array<string> | string) {
    this.tables = isArray(tables) ? tables : [tables];
    return this;
  }

  public setColumn(column: string) {
    this.column.push(column);
    return this;
  }

  public setColumns(columns: Array<string>) {
    this.column.concat(columns);
    return this;
  }

  public where(condition: ICondition) {
    this.conditions.push(condition);
    return this;
  }

  public and(condition: ICondition) {
    this.conditions.push(condition);
    return this;
  }

  public or(condition: ICondition) {
    this.conditions.push(condition);
    return this;
  }

  public run() {
    let promise = new Promise((resolve, reject) =>
      this.connection.query(this.toSql(), (error, sucess) => {
        if (error) return reject(error);
        else return resolve(sucess);
      })
    );
    promise.finally(() => this.connection.destroy());
    return promise
  }

  private parseCommand(command: Command) {
    switch (command) {
      case Command.SELECT:
        return "SELECT";
      case Command.DELETE:
        return "DELETE";
      case Command.DROP:
        return "DROP";
      case Command.UPDATE:
        return "UPDATE";
    }
  }

  private parseOperator(operator: Operator) {
    switch (operator) {
      case Operator.WHERE:
        return "WHERE";
      case Operator.AND:
        return "AND";
      case Operator.IN:
        return "IN";
      case Operator.OR:
        return "OR";
    }
  }

  private parseCondition(condition: Condition) {
    switch (condition) {
      case Condition.EQUAL:
        return "=";
    }
  }

  private toSql() {
    let str: string;
    str = `${this.parseCommand(this.command)} ${this.separator(
      this.column
    )} FROM ${this.separator(this.tables)} `;
    str += this.conditions
      .map(
        c =>
          `${this.parseOperator(c.operator)} ${c.column} ${this.parseCondition(
            c.condition
          )} '${c.value}'`
      )
      .join(" ");
    return str;
  }
}

export interface INoSQLConfig {
  createSchemas: boolean,
  schemasPach: string;
}

export default class NoSQLMysql implements INoSQLConfig {
  createSchemas: boolean;
  schemasPach: string;
  private connectionConfig: ConnectionConfig;
  private connection: Connection;

  constructor(ConnectionConfig: ConnectionConfig, NoSQLConfig: INoSQLConfig) {
    this.connectionConfig = ConnectionConfig;
    this.createSchemas = NoSQLConfig.createSchemas;
    this.schemasPach = NoSQLConfig.schemasPach;
    this.connection = createConnection(this.connectionConfig);
    if (this.createSchemas)
      this.prepare();
  }

  private prepare() {
    new SchemasConstructor(this, `${__dirname}/schemas/`);
  }

  public select(columns: Array<string> | string) {
    let array = isArray(columns) ? columns : [columns];
    if (array.length === 0 && array[0] === null)
      return new Query(Command.SELECT, this.connection).setColumn("*");

    return new Query(Command.SELECT, this.connection).setColumns(array);
  }

  public runQuery(query: string) {
    return new Promise((resolve, reject) => this.connection.query(query, (error: MysqlError, rows: any) => {
      if (error) return reject(error);
      return resolve(rows);
    }))
  }
}

const nosql: NoSQLMysql = new NoSQLMysql({
  user: "root",
  password: "admin123",
  host: "127.0.0.1",
  database: "test"
}, { createSchemas: true, schemasPach: './schemas/' });
/*nosql
  .select("id")
  .from("users")
  .where({
    column: "username",
    operator: Operator.WHERE,
    value: "Lucas",
    condition: Condition.EQUAL
  })
  .and({
    column: "id",
    operator: Operator.AND,
    value: "2",
    condition: Condition.EQUAL
  })
  .run()
  .then(rows => console.log(rows));*/
