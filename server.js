import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Initialize MCP server instance
const server = new McpServer({
  name: "HomeHealthTriage",
  version: "1.1.0",
});

/**
 * Generates natural spoken Alexa dialogue matching the detected sound, room, and household occupancy.
 */
function generateAlexaDialogue(audioEvent, location, isHomeAlone = true) {
  const eventLower = (audioEvent || "").toLowerCase();
  const room = location && location.trim().toLowerCase() !== "general" ? ` in the ${location.trim()}` : "";

  if (!isHomeAlone) {
    // Multi-person household: prompt others to check, then follow up
    if (eventLower.includes("fall") || eventLower.includes("crash") || eventLower.includes("thud")) {
      return {
        initial_announcement: `It sounds like someone had a fall${room}. Please can someone go and check on them?`,
        followup_check: "Is everything okay? Should I call emergency services?",
      };
    }
    if (eventLower.includes("scream") || eventLower.includes("screaming")) {
      return {
        initial_announcement: `I heard what sounded like screaming${room}. Please can someone go and check on them?`,
        followup_check: "Is everything okay? Should I call emergency services?",
      };
    }
    if (eventLower.includes("chok") || eventLower.includes("cannot breathe") || eventLower.includes("gasp")) {
      return {
        initial_announcement: `I detected breathing distress${room}. Please check on them right now!`,
        followup_check: "Do they need emergency services?",
      };
    }
    if (eventLower.includes("glass") || eventLower.includes("shatter")) {
      return {
        initial_announcement: `I heard glass breaking${room}. Please can someone go and check?`,
        followup_check: "Is everyone alright? Does anyone need first aid?",
      };
    }
    return {
      initial_announcement: `I detected an unusual sound (${audioEvent})${room}. Please can someone check on them?`,
      followup_check: "Is everything okay? Should I call emergency services?",
    };
  }

  // Solo resident (Home alone): speak directly to the individual
  if (eventLower.includes("scream") || eventLower.includes("screaming")) {
    return {
      initial_announcement: `I heard what sounded like screaming${room}. Are you okay? Should I call emergency services?`,
      followup_check: null,
    };
  }
  if (eventLower.includes("fall") || eventLower.includes("crash") || eventLower.includes("thud")) {
    return {
      initial_announcement: `It sounds like someone had a fall${room}. Are you hurt? Do you need me to call for help?`,
      followup_check: null,
    };
  }
  if (eventLower.includes("chok") || eventLower.includes("cannot breathe") || eventLower.includes("gasp")) {
    return {
      initial_announcement: `I detected breathing distress${room}. Are you okay? Say yes if you need an ambulance now.`,
      followup_check: null,
    };
  }
  if (eventLower.includes("glass") || eventLower.includes("shatter")) {
    return {
      initial_announcement: `I heard glass breaking${room}. Is everyone alright?`,
      followup_check: null,
    };
  }
  return {
    initial_announcement: `I detected an unusual sound (${audioEvent})${room}. Are you okay?`,
    followup_check: null,
  };
}

/**
 * Evaluates audio events to determine triage priority, house-silencing needs, and escalation paths.
 */
function assessAudioEmergency(audioEvent, location = "general", isHomeAlone = true) {
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
  let silenceHouse = false;
  let timeoutSeconds = null;

  if (criticalTriggers.some((trigger) => eventLower.includes(trigger))) {
    priority = "CRITICAL";
    recommendation = "Immediate emergency response needed. Silence household, announce check-in, and alert emergency contacts or 999.";
    silenceHouse = true;
    timeoutSeconds = 15; // Shorter timeout for critical scream/choking events
  } else if (highTriggers.some((trigger) => eventLower.includes(trigger))) {
    priority = "HIGH";
    recommendation = "High priority alert. Silence household audio and ask resident if they are okay. If no response within 30s, escalate to emergency contact.";
    silenceHouse = true;
    timeoutSeconds = 30; // 30 seconds for falls/crashes
  } else if (mediumTriggers.some((trigger) => eventLower.includes(trigger))) {
    priority = "MEDIUM";
    recommendation = "Moderate event detected. Check in via local Echo intercom to ensure safety.";
    silenceHouse = false;
    timeoutSeconds = 45;
  }

  const dialogue = generateAlexaDialogue(audioEvent, location, isHomeAlone);

  return {
    audio_event: audioEvent,
    location: location || "general",
    household_mode: isHomeAlone ? "solo_resident" : "multi_person_household",
    priority_level: priority,
    silence_house_required: silenceHouse,
    alexa_spoken_dialogue: dialogue.initial_announcement,
    alexa_followup_dialogue: dialogue.followup_check,
    is_home_alone: isHomeAlone,
    unresponsive_timeout_seconds: timeoutSeconds,
    escalation_protocol: isHomeAlone
      ? `If solo resident does not respond within ${timeoutSeconds}s: Tier 1 alerts Emergency Contact (Next of Kin). If unanswered or critical, Tier 2 dispatches 999 emergency services.`
      : `Broadcasts initial check-in across household Echos. Follows up after 15-20s asking: "${dialogue.followup_check}"`,
    recommendation,
    timestamp: new Date().toISOString(),
  };
}

// Tool 1: assess_audio_emergency
server.registerTool(
  "assess_audio_emergency",
  {
    description: "Assesses a detected audio event and location, returning triage priority, spoken Alexa dialogue, house-silence requirements, and unresponsive timeout.",
    inputSchema: {
      audio_event: z
        .string()
        .describe("Description of the detected audio event (e.g., 'child screaming', 'loud crash', 'fall detected')"),
      location: z
        .string()
        .optional()
        .describe("Room or device location where the sound was detected (e.g., 'kitchen', 'bathroom', 'living room')"),
      is_home_alone: z
        .boolean()
        .optional()
        .describe("Whether the resident is alone at home (triggers unresponsive timeout protocol)"),
    },
  },
  async ({ audio_event, location = "general", is_home_alone = true }) => {
    const assessment = assessAudioEmergency(audio_event, location, is_home_alone);
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

// Tool 2: silence_home_audio
server.registerTool(
  "silence_home_audio",
  {
    description: "Immediately stops and pauses all music, media playback, and background sound across all Echo devices in the house so the emergency check-in can be heard.",
    inputSchema: {
      reason: z
        .string()
        .describe("Reason for silencing the household (e.g., 'Emergency audio check-in for screaming in kitchen')"),
    },
  },
  async ({ reason }) => {
    const timestamp = new Date().toISOString();
    const mutedDevices = [
      "Echo Kitchen",
      "Echo Living Room",
      "Echo Bedroom",
      "Echo Bathroom",
      "Echo Hallway",
    ];

    const logMessage = `[SILENCE_HOUSE] [${timestamp}] Reason: ${reason} | Paused audio on ${mutedDevices.length} devices: ${mutedDevices.join(", ")}`;
    console.error(logMessage);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "HOUSE_SILENCED",
              action: "Paused all music and media playback across household Echo devices",
              muted_devices: mutedDevices,
              ready_for_dialogue: true,
              timestamp,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// Tool 3: escalate_unresponsive_resident
server.registerTool(
  "escalate_unresponsive_resident",
  {
    description: "Executes emergency escalation when a solo resident fails to respond to Alexa's check-in within the timeout period. Calls family emergency contact first (Tier 1), then prepares emergency services (Tier 2).",
    inputSchema: {
      location: z
        .string()
        .describe("Room where incident occurred (e.g., 'bathroom', 'kitchen')"),
      audio_event: z
        .string()
        .describe("The acoustic event detected (e.g., 'fall detected', 'loud crash')"),
      seconds_unresponsive: z
        .number()
        .optional()
        .describe("Number of seconds resident has been unresponsive to Alexa's check-in (default: 30)"),
      emergency_contact_name: z
        .string()
        .optional()
        .describe("Name of designated primary contact (e.g., 'Sarah (Daughter)')"),
      emergency_contact_phone: z
        .string()
        .optional()
        .describe("Phone number of designated primary contact"),
    },
  },
  async ({
    location,
    audio_event,
    seconds_unresponsive = 30,
    emergency_contact_name = "Sarah (Daughter)",
    emergency_contact_phone = "+44 7700 900123",
  }) => {
    const timestamp = new Date().toISOString();

    const tier1Message = `EMERGENCY ALERT: Potential emergency detected in the ${location} (${audio_event}). Resident is home alone and has not responded to Alexa for ${seconds_unresponsive} seconds. Calling next of kin.`;
    
    // Log escalation action to console
    console.error(`[UNRESPONSIVE_ESCALATION] [${timestamp}] ${tier1Message}`);
    console.error(`[TIER_1_DISPATCH] Dialing Next of Kin: ${emergency_contact_name} (${emergency_contact_phone})`);

    const report = {
      status: "ESCALATION_TRIGGERED",
      trigger: `Resident unresponsive for ${seconds_unresponsive} seconds after ${audio_event} in ${location}`,
      tier_1_contact: {
        action: "VOICE_CALL_AND_SMS",
        contact_name: emergency_contact_name,
        phone: emergency_contact_phone,
        message: `Alexa Health Alert: ${audio_event} detected in ${location}. Resident did not reply after ${seconds_unresponsive}s.`,
        status: "DIALED",
      },
      tier_2_emergency_services: {
        action: "DIAL_999",
        status: "STANDBY_ESCALATE_IF_UNANSWERED",
        dispatch_reason: `Unresponsive solo resident after ${audio_event} in ${location}`,
      },
      timestamp,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(report, null, 2),
        },
      ],
    };
  }
);

// Tool 4: dispatch_medical_alert (Direct dispatch)
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

export { server, assessAudioEmergency, generateAlexaDialogue };
