// A small, readable expression language for data/rules.json.
// Booleans, comparisons, `in`, and a few list helpers. No assignment, no loops.

export type NodeType = "people" | "data" | "purpose" | "system" | "company";

export interface Env {
  lookup(name: string): unknown;
  nodes(type: string): Env[];
}

type Ast =
  | { k: "lit"; v: unknown }
  | { k: "path"; parts: string[] }
  | { k: "list"; items: Ast[] }
  | { k: "not"; a: Ast }
  | { k: "bin"; op: string; a: Ast; b: Ast }
  | { k: "call"; name: string; args: Ast[] };

type Tok = { t: "num" | "str" | "id" | "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9]/.test(c) || (c === "-" && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: "num", v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "'") {
      const j = src.indexOf("'", i + 1);
      if (j < 0) throw new Error(`Unclosed quote in: ${src}`);
      out.push({ t: "str", v: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: "id", v: src.slice(i, j) });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["&&", "||", "==", "!=", ">=", "<="].includes(two)) {
      out.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if ("!<>()[],.".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected '${c}' in: ${src}`);
  }
  return out;
}

class Parser {
  private i = 0;
  constructor(private toks: Tok[], private src: string) {}

  parse(): Ast {
    const a = this.or();
    if (this.i < this.toks.length) this.fail(`unexpected '${this.toks[this.i].v}'`);
    return a;
  }

  private peek(v?: string): Tok | undefined {
    const t = this.toks[this.i];
    if (v === undefined) return t;
    return t && t.v === v && (t.t === "op" || t.t === "id") ? t : undefined;
  }

  private eat(v: string): void {
    if (!this.peek(v)) this.fail(`expected '${v}'`);
    this.i++;
  }

  private fail(msg: string): never {
    throw new Error(`Rule expression error (${msg}) in: ${this.src}`);
  }

  private or(): Ast {
    let a = this.and();
    while (this.peek("||")) { this.i++; a = { k: "bin", op: "||", a, b: this.and() }; }
    return a;
  }

  private and(): Ast {
    let a = this.not();
    while (this.peek("&&")) { this.i++; a = { k: "bin", op: "&&", a, b: this.not() }; }
    return a;
  }

  private not(): Ast {
    if (this.peek("!")) { this.i++; return { k: "not", a: this.not() }; }
    return this.cmp();
  }

  private cmp(): Ast {
    const a = this.primary();
    const t = this.peek();
    if (!t) return a;
    if (t.t === "op" && ["==", "!=", ">=", "<=", ">", "<"].includes(t.v)) {
      this.i++;
      return { k: "bin", op: t.v, a, b: this.primary() };
    }
    if (t.t === "id" && t.v === "in") {
      this.i++;
      return { k: "bin", op: "in", a, b: this.primary() };
    }
    if (t.t === "id" && t.v === "not" && this.toks[this.i + 1]?.v === "in") {
      this.i += 2;
      return { k: "not", a: { k: "bin", op: "in", a, b: this.primary() } };
    }
    return a;
  }

  private primary(): Ast {
    const t = this.toks[this.i];
    if (!t) this.fail("unexpected end");
    if (t.t === "num") { this.i++; return { k: "lit", v: Number(t.v) }; }
    if (t.t === "str") { this.i++; return { k: "lit", v: t.v }; }
    if (t.t === "op" && t.v === "(") {
      this.i++;
      const a = this.or();
      this.eat(")");
      return a;
    }
    if (t.t === "op" && t.v === "[") {
      this.i++;
      const items: Ast[] = [];
      while (!this.peek("]")) {
        items.push(this.or());
        if (this.peek(",")) this.i++;
        else break;
      }
      this.eat("]");
      return { k: "list", items };
    }
    if (t.t === "id") {
      this.i++;
      if (t.v === "true") return { k: "lit", v: true };
      if (t.v === "false") return { k: "lit", v: false };
      if (t.v === "null") return { k: "lit", v: null };
      if (this.peek("(")) {
        this.i++;
        const args: Ast[] = [];
        while (!this.peek(")")) {
          args.push(this.or());
          if (this.peek(",")) this.i++;
          else break;
        }
        this.eat(")");
        return { k: "call", name: t.v, args };
      }
      const parts = [t.v];
      while (this.peek(".")) {
        this.i++;
        const n = this.toks[this.i];
        if (!n || n.t !== "id") this.fail("expected a name after '.'");
        parts.push(n.v);
        this.i++;
      }
      return { k: "path", parts };
    }
    this.fail(`unexpected '${t.v}'`);
  }
}

const cache = new Map<string, Ast>();

export function parse(src: string): Ast {
  let ast = cache.get(src);
  if (!ast) {
    ast = new Parser(tokenize(src), src).parse();
    cache.set(src, ast);
  }
  return ast;
}

const truthy = (v: unknown) => !!v && !(Array.isArray(v) && v.length === 0);
const isNil = (v: unknown) => v === null || v === undefined;

function typeArg(ast: Ast, fn: string): string {
  if (ast.k !== "path" || ast.parts.length !== 1) throw new Error(`${fn}() needs a node type first, like ${fn}(data, ...)`);
  return ast.parts[0];
}

function evalAst(ast: Ast, env: Env): unknown {
  switch (ast.k) {
    case "lit":
      return ast.v;
    case "list":
      return ast.items.map((x) => evalAst(x, env));
    case "path": {
      let v = env.lookup(ast.parts[0]);
      for (const p of ast.parts.slice(1)) v = isNil(v) ? undefined : (v as Record<string, unknown>)[p];
      return v;
    }
    case "not":
      return !truthy(evalAst(ast.a, env));
    case "bin": {
      if (ast.op === "&&") return truthy(evalAst(ast.a, env)) && truthy(evalAst(ast.b, env));
      if (ast.op === "||") return truthy(evalAst(ast.a, env)) || truthy(evalAst(ast.b, env));
      const a = evalAst(ast.a, env);
      const b = evalAst(ast.b, env);
      switch (ast.op) {
        case "==": return isNil(a) && isNil(b) ? true : a === b;
        case "!=": return isNil(a) && isNil(b) ? false : a !== b;
        case "in": return Array.isArray(b) ? b.some((x) => (isNil(x) && isNil(a)) || x === a) : false;
      }
      if (isNil(a) || isNil(b)) return false;
      const x = a as number, y = b as number;
      switch (ast.op) {
        case ">=": return x >= y;
        case "<=": return x <= y;
        case ">": return x > y;
        case "<": return x < y;
      }
      throw new Error(`Unknown operator ${ast.op}`);
    }
    case "call": {
      const { name, args } = ast;
      if (name === "any" || name === "all" || name === "count") {
        const nodes = env.nodes(typeArg(args[0], name));
        const test = (n: Env) => (args[1] ? truthy(evalAst(args[1], n)) : true);
        if (name === "any") return nodes.some(test);
        if (name === "all") return nodes.every(test);
        return nodes.filter(test).length;
      }
      const vals = args.map((x) => evalAst(x, env));
      const list = (v: unknown) => (Array.isArray(v) ? v : []);
      if (name === "overlaps") return list(vals[0]).some((x) => list(vals[1]).includes(x));
      if (name === "subset") return list(vals[0]).every((x) => list(vals[1]).includes(x));
      if (name === "len") return list(vals[0]).length;
      throw new Error(`Unknown function ${name}()`);
    }
  }
}

export function evaluate(src: string, env: Env): unknown {
  return evalAst(parse(src), env);
}

export function test(src: string, env: Env): boolean {
  return truthy(evaluate(src, env));
}

/** Fill {name} placeholders from an env. */
export function fill(template: string, env: Env): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = env.lookup(k);
    return isNil(v) ? "" : Array.isArray(v) ? v.join(", ") : String(v);
  });
}
