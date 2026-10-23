# Alexa Home Health Triage 🚑

An intelligent ambient acoustic triage system built as a local **Model Context Protocol (MCP)** server. Designed to integrate with smart home devices (such as Amazon Alexa) and AI assistant agents, this server continuously evaluates acoustic emergency events in real-time, categorizes them into medical triage priority levels, and automates emergency dispatch actions.

---

## 🌟 Overview

When an Alexa device or ambient microphone captures sudden household sounds—such as a child screaming, a heavy fall, or a loud crash—this MCP server provides the reasoning and action interface for an LLM to:

1. **Assess Severity**: Determine triage urgency (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) with tailored medical recommendations.
2. **Dispatch Alerts**: Trigger escalation protocols (e.g., intercom notifications, caregiver alerts, or emergency services dispatch) with audit logging.

Built using the official [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) on Node.js using standard `stdio` transport.

---

## 🛠️ MCP Tools Exposed

The server registers two tools under the `HomeHealthTriage` MCP namespace:

### 1. `assess_audio_emergency`
- **Description**: Assesses detected acoustic events and assigns a triage priority level with clinical recommendations.
- **Input Parameters**:
  - `audio_event` (string, required): Description of the detected acoustic event (e.g. `'child screaming'`, `'loud crash'`, `'glass shattering'`).
- **Response**: Returns a JSON object containing:
  - `audio_event`: Echoes the acoustic input.
  - `priority_level`: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`.
  - `recommendation`: Actionable medical guidance.
  - `timestamp`: ISO 8601 evaluation timestamp.

### 2. `dispatch_medical_alert`
- **Description**: Triggers and logs a medical dispatch action via chosen communication channels.
- **Input Parameters**:
  - `contact_method` (string, required): The target escalation channel (e.g. `'intercom_parent'`, `'dial_999'`, `'sms_caregiver'`).
  - `reason` (string, required): Contextual justification for dispatching the alert.
- **Response**: Status confirmation string and persistent dispatch logging.

---

## 📋 Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

---

## 🚀 Quick Start & Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/temietech/alexa-health-triage.git
   cd alexa-health-triage
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the MCP Server**:
   ```bash
   npm start
   ```
   *(The server connects over `stdio` and waits for MCP client requests).*

---

## 🔍 Testing & Evaluation (For Judges)

This project runs as a local Node.js **Model Context Protocol (MCP)** server utilizing `stdio` transport. Judges and evaluators can verify and execute the server tools locally without needing external API keys or cloud deployments.

### 1. Evaluate `assess_audio_emergency` Directly

Run the following command in the project directory to evaluate a high-priority `'loud crash'` event:

```bash
node -e "import('./server.js').then(async ({ server }) => { const result = await server._registeredTools['assess_audio_emergency'].handler({ audio_event: 'loud crash' }); console.log(JSON.stringify(result, null, 2)); process.exit(0); })"
```

#### Expected Output:
```json
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"audio_event\": \"loud crash\",\n  \"priority_level\": \"HIGH\",\n  \"recommendation\": \"High priority alert. Verify resident status immediately via two-way intercom; escalate if unacknowledged.\",\n  \"timestamp\": \"2026-10-23T00:17:45.964Z\"\n}"
    }
  ]
}
```

### 2. Evaluate Critical Emergency ('child screaming')

```bash
node -e "import('./server.js').then(async ({ server }) => { const result = await server._registeredTools['assess_audio_emergency'].handler({ audio_event: 'child screaming' }); console.log(JSON.stringify(result, null, 2)); process.exit(0); })"
```

### 3. Evaluate `dispatch_medical_alert`

```bash
node -e "import('./server.js').then(async ({ server }) => { const result = await server._registeredTools['dispatch_medical_alert'].handler({ contact_method: 'dial_999', reason: 'Unresponsive fall detected after loud crash' }); console.log(JSON.stringify(result, null, 2)); process.exit(0); })"
```

### 4. Interactive Testing via MCP Inspector

You can also test the tools visually via the official MCP Inspector web UI:

```bash
npx @modelcontextprotocol/inspector node server.js
```

This launches a local web interface where you can inspect schemas, send custom inputs, and observe tool outputs interactively.

---

## ⚙️ MCP Client Configuration

To register this server with an MCP-compatible host (such as Claude Desktop or custom agents), add the following to your configuration file:

```json
{
  "mcpServers": {
    "HomeHealthTriage": {
      "command": "node",
      "args": ["/path/to/alexa-health-triage/server.js"]
    }
  }
}
```

---

## 📄 License

ISC License. See [package.json](package.json) for details.
