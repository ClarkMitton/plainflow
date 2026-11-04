import rules from "../../data/rules.json";
import requirements from "../../data/requirements.json";
import products from "../../data/products.json";
import lawJson from "../../data/law.json";
import type { RuleSet } from "./types";

const laws = Object.fromEntries(Object.entries(lawJson.laws).map(([id, l]) => [id, { id, ...l }]));
export const ruleSet = { rules, requirements, products, laws } as unknown as RuleSet;
