import rules from "../../data/rules.json";
import requirements from "../../data/requirements.json";
import products from "../../data/products.json";
import type { RuleSet } from "./types";

export const ruleSet = { rules, requirements, products } as unknown as RuleSet;
