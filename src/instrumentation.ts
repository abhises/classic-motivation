export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutopilot } = await import("./lib/autopilot");
    startAutopilot();
  }
}
