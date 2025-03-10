import { spawn } from 'child_process';

// Simple demo to demonstrate NHL API functionality
console.log("NHL API - Simplified Demo");
console.log("=========================\n");

console.log("To use the NHL API tools via MCP, run:");
console.log("  node dist/server.js\n");

console.log("Available tools:");
console.log("  1. get-team - Get information about an NHL team");
console.log("    Example: { teamAbbrev: 'TOR' }\n");

console.log("  2. get-player - Get information about an NHL player");
console.log("    Example: { playerId: 8478402 } (Connor McDavid)\n");

console.log("  3. get-standings - Get current NHL standings");
console.log("    Example: { division: 'Atlantic' }\n");

console.log("  4. get-schedule - Get NHL game schedule");
console.log("    Example: { teamAbbrev: 'TOR', date: '2024-03-15' }\n");

console.log("  5. get-skater-leaders - Get NHL statistical leaders for skaters");
console.log("    Example: { category: 'goals', limit: 5 }\n");

console.log("To interact with the server, send JSON-RPC requests to stdin in the format:");
console.log(`{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "call",
  "params": {
    "name": "get-team",
    "input": {
      "teamAbbrev": "TOR"
    }
  }
}`);

// Start the server to show it works
const server = spawn('node', ['dist/server.js']);
server.stderr.on('data', (data) => {
  console.log("\nServer message:", data.toString());
});

// Close the server after 2 seconds
setTimeout(() => {
  server.kill();
  console.log("\nServer terminated. Run manually with 'npm start'");
}, 2000);