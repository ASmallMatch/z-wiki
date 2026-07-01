// index.ts — 薄入口:构建 AgentHost + Interaction,listen。
// Interaction 主体在 interaction.ts,可脱离 server 启动单测 import。
import { buildAgentContext } from "./agentHost.js";
import { createInteraction } from "./interaction.js";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "127.0.0.1";

const start = async (): Promise<void> => {
  try {
    const agentCtx = await buildAgentContext();
    const interaction = await createInteraction(agentCtx);
    interaction.log.info("agent context ready");
    const total = await interaction.refreshView();
    interaction.log.info({ total }, "initial buildView done");
    await interaction.app.listen({ port: PORT, host: HOST });
    interaction.log.info(`z-wiki server on http://${HOST}:${PORT}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

void start();
