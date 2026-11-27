import { defineRule } from "@oxlint/plugins";

/** Keep application state in the owning component or resource. */
export const noModuleLevelMutableStateRule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow mutable variables declared at module scope." },
    messages: {
      moduleState: "Move module-level mutable state into its owning model, function, or resource.",
    },
  },
  createOnce(context) {
    return {
      VariableDeclaration(node) {
        if ((node.kind !== "let" && node.kind !== "var") || node.declare === true) return;
        const statement = node.parent.type === "ExportNamedDeclaration" ? node.parent : node;
        if (statement.parent?.type === "Program") {
          context.report({ node, messageId: "moduleState" });
        }
      },
    };
  },
});
