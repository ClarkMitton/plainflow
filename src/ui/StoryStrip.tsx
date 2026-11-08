import { Fragment, type ReactNode } from "react";
import type { FlowNode } from "../engine/types";
import { useFlow } from "./context";
import { keepAcronyms, roleParts } from "./flowOps";

/**
 * The sentence the flow tells, read off the canvas. Each word is its node: underlined in the node's
 * family colour, hover to trace it, click to open it. It's the bridge between what was said and the picture.
 */
export function StoryStrip() {
  const { flow, d, select, setTrace, trace } = useFlow();
  const of = (type: string, pred: (n: FlowNode) => boolean = () => true) => flow.nodes.filter((n) => n.type === type && pred(n));
  const staff = of("people", (n) => n.fields.group === "staff");
  const subjects = of("people", (n) => n.fields.group !== "staff");
  const data = of("data");
  const systems = of("system");
  // "into Otter, run by Otter" says nothing twice: a company named like its tool is left out of "run by".
  const toolNames = new Set(systems.map((n) => n.title.trim().toLowerCase()));
  const receiving = of("company", (n) => n.levers.role !== "sub_processor" && Number(d.facts[n.id]?.receives_tier ?? -1) >= 0 && !toolNames.has(n.title.trim().toLowerCase()));
  // A supplier runs the tool for you; a partner decides things with you, so it's "shared with", not "run by".
  const isPartner = (n: FlowNode) => n.levers.role === "joint_controller" || n.levers.role === "independent_controller";
  // A connector's other end doesn't run the tool; the data goes on to it.
  const onward = receiving.filter((n) => !isPartner(n) && n.fields.via_connector === true);
  const companies = receiving.filter((n) => !isPartner(n) && n.fields.via_connector !== true);
  const partners = receiving.filter(isPartner);
  const purposes = of("purpose");

  if (!flow.nodes.length) return <div className="story-strip mu">Add a node to start the diagram.</div>;
  const who = staff.length === 1 ? roleParts(staff[0].title) : { article: "", plural: staff.length > 1 };

  const chip = (n: FlowNode, lower = false) => (
    <button
      key={n.id}
      type="button"
      className={`chip c-${n.type}`}
      onClick={() => select(n.id)}
      onMouseEnter={() => setTrace({ node: n.id })}
      onMouseLeave={() => setTrace(null)}
    >
      {lower ? keepAcronyms(n.title) : n.title}
    </button>
  );
  const list = (ns: FlowNode[], lower = false): ReactNode =>
    ns.map((n, i) => (
      <Fragment key={n.id}>
        {i > 0 && (i === ns.length - 1 ? " and " : ", ")}
        {chip(n, lower)}
      </Fragment>
    ));

  // A flow opened from a code scan reads differently: the app handles data and sends it to services.
  if (flow.source?.kind === "scan") {
    return (
      <div className="story-strip" aria-label="The story of this flow">
        {trace && trace.data.length > 0 && <Route />}
        {systems.length ? list(systems) : "The app"} handles {data.length ? list(data, true) : "data"}
        {subjects.length > 0 && <> about {list(subjects, true)}</>}
        {companies.length > 0 && <>, and sends it to {list(companies)}</>}
        {partners.length > 0 && <>, shared with {list(partners)}</>}
        {purposes.length > 0 && <>, to {list(purposes, true)}</>}.
      </div>
    );
  }

  return (
    <div className="story-strip" aria-label="The story of this flow">
      {trace && trace.data.length > 0 && <Route />}
      {staff.length === 0 ? "Someone" : who.article ? <>{who.article}{list(staff, true)}</> : list(staff)}
      {flow.retrospective ? (who.plural ? " have been putting " : " has been putting ") : who.plural ? " put " : " puts "}
      {data.length ? list(data, true) : "data"}
      {subjects.length > 0 && <> about {list(subjects, true)}</>}
      {systems.length > 0 && <> into {list(systems)}</>}
      {companies.length > 0 && <>, run by {list(companies)}</>}
      {onward.length > 0 && <>, and on to {list(onward)}</>}
      {partners.length > 0 && <>, shared with {list(partners)}</>}
      {purposes.length > 0 && <>, to {list(purposes, true)}</>}.
    </div>
  );
}

/** While a route is traced, say in words where the data goes, in the order it travels. */
function Route() {
  const { flow, d, trace } = useFlow();
  if (!trace) return null;
  const title = (id: string) => flow.nodes.find((n) => n.id === id)?.title ?? id;
  const order: string[] = [];
  const queue = [...trace.data];
  const seen = new Set(queue);
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of flow.edges.filter((x) => x.from === id && trace.edges.has(x.id))) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      order.push(e.to);
      queue.push(e.to);
    }
  }
  const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "");
  const inside = order.filter((id) => flow.nodes.find((n) => n.id === id)?.inside).map(title);
  const outside = order
    .filter((id) => !flow.nodes.find((n) => n.id === id)?.inside)
    .map((id) => {
      const parent = flow.edges.find((e) => e.kind === "sub_processor" && e.to === id)?.from;
      return parent ? `${title(id)}, working for ${title(parent)}` : title(id);
    });
  const tier = Math.max(...trace.data.map((x) => d.tiers[x] ?? 0));
  return (
    <div className="route" role="status">
      <strong>{and(trace.data.map(title))}</strong> (Tier {tier})
      {inside.length > 0 && <> goes to {and(inside)} inside the organisation</>}
      {outside.length > 0 && <>{inside.length ? ", and" : ""} leaves to <strong>{and(outside)}</strong></>}
      {!inside.length && !outside.length && " doesn't go anywhere yet"}.
    </div>
  );
}
