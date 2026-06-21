import type { ProcessedRequest } from '../lib/dataProcessing';

/** Builds the request-flow timeline off the main thread so 100k+ rows do not freeze the tab. */
self.onmessage = async (event: MessageEvent<{ rows: ProcessedRequest[] }>) => {
  const { prepareRequestFlowTimeline } = await import('../lib/homeRequestFlowMap');
  const result = prepareRequestFlowTimeline(event.data.rows);
  self.postMessage({ result });
};
