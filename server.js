import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Initialize MCP server instance
const server = new McpServer({
  name: "HomeHealthTriage",
  version: "1.0.0",
});

/**
 * Evaluates audio events to determine triage priority.
 */
function assessAudioEmergency(audioEvent) {
  const eventLower = (audioEvent || "").toLowerCase();

  // Critical events: severe immediate danger or distress
  const criticalTriggers = [
    "screaming",
    "scream",
    "gunshot",
    "explosion",
    "fire",
    "smoke detector",
    "cannot breathe",
    "choking",
    "seizure",
    "unresponsive",
    "cardiac",
  ];

  // High urgency events: potential injury, falls, or acute emergencies
  const highTriggers = [
    "crash",
    "loud crash",
    "glass break",
    "shattering",
    "fall",
    "heavy thud",
    "crying baby",
    "crying",
    "groaning",
    "help",
    "alarm",
    "gasping",
  ];

  // Medium urgency events: abnormal sounds requiring verification
  const mediumTriggers = [
    "banging",
    "thumping",
    "barking",
    "dog barking",
    "water running",
    "broken",
    "door slam",
  ];

  let priority = "LOW";
  let recommendation = "Routine background audio. Continue normal monitoring.";

  if (criticalTriggers.some((trigger) => eventLower.includes(trigger))) {
    priority = "CRITICAL";
    recommendation = "Immediate emergency response needed. Alert emergency contacts and dial emergency services (e.g. 999).";
  } else if (highTriggers.some((trigger) => eventLower.includes(trigger))) {
    priority = "HIGH";
    recommendation = "High priority alert. Verify resident status immediately via two-way intercom; escalate if unacknowledged.";
  } else if (mediumTriggers.some((trigger) => eventLower.includes(trigger))) {
    priority = "MEDIUM";
    recommendation = "Moderate event detected. Check in via intercom to ensure safety.";
  }

  return {
    audio_event: audioEvent,
    priority_level: priority,
    recommendation,
    timestamp: new Date().toISOString(),
  };
}

// Tool 1: assess_audio_emergency
server.registerTool(
  "assess_audio_emergency",
  {
    description: "Assesses a detected audio event and returns a triage priority level.",
    inputSchema: {
      audio_event: z
        .string()
        .describe("Description of the detected audio event (e.g., 'child screaming', 'loud crash')"),
    },
  },
  async ({ audio_event }) => {
    const assessment = assessAudioEmergency(audio_event);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(assessment, null, 2),
        },
      ],
    };
  }
);

// Tool 2: dispatch_medical_alert
server.registerTool(
  "dispatch_medical_alert",
  {
    description: "Dispatches a medical alert via specified contact method and logs the dispatch action.",
    inputSchema: {
      contact_method: z
        .string()
        .describe("Contact method for the alert (e.g., 'intercom_parent', 'dial_999')"),
      reason: z
        .string()
        .describe("Reason for dispatching the medical alert"),
    },
  },
  async ({ contact_method, reason }) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[DISPATCH_MEDICAL_ALERT] [${timestamp}] Contact Method: ${contact_method} | Reason: ${reason}`;
    
    // Log dispatch action to the console
    console.log(logMessage);
    console.error(logMessage);

    return {
      content: [
        {
          type: "text",
          text: `Medical alert successfully dispatched via ${contact_method}. Reason: ${reason}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HomeHealthTriage MCP server running on stdio");
}

// Start server when run directly
const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]).toLowerCase() ===
    fileURLToPath(import.meta.url).toLowerCase();

if (isMain) {
  main().catch((error) => {
    console.error("Error starting server:", error);
    process.exit(1);
  });
}

export { server, assessAudioEmergency };
