export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCandleCollector } = await import("./lib/market/candleCollector");
    startCandleCollector();
  }
}
