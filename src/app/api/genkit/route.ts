import { appRoute } from "@genkit-ai/next";
import { suerteFlow } from "@/genkit/flows/suerteFlow";

export const POST = appRoute(suerteFlow);

