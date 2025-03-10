# NHL API - Model Context Protocol

A TypeScript implementation of the NHL API using the Model-Context Protocol pattern. This MCP server provides access to NHL data including teams, players, standings, schedules, and statistics.

## Overview

This library provides a clean interface to the NHL's official APIs using the Model-Context Protocol (MCP). It allows you to fetch data from the NHL's APIs and provides it in a structured, easy-to-use format through MCP tools.

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-nhl-api.git
cd mcp-nhl-api

# Install dependencies
npm install

# Build the project
npm run build
```

## Running the MCP Server

```bash
# Using npm start (production)
npm start

# Using development mode with automatic reloading
npm run dev

# Run the demo
npm run demo
```

## Project Structure

The project has a minimalist structure:

```
mcp-nhl-api/
│
├── dist/           # Compiled JavaScript files
├── src/
│   ├── server.ts   # Main MCP server implementation
│   └── demo.ts     # Simple demo client
├── docs/
│   └── RAWDOC.md   # Detailed NHL API documentation
└── package.json    # Project dependencies and scripts
```

## Available Tools

The NHL API MCP server provides the following tools:

### get-team

Get information about an NHL team.

```typescript
{
  teamAbbrev: string; // Three-letter team abbreviation (e.g., "TOR" for Toronto Maple Leafs)
}
```

### get-player

Get information about an NHL player.

```typescript
{
  playerId: number; // NHL player ID (e.g., 8478402 for Connor McDavid)
}
```

### get-standings

Get current NHL standings.

```typescript
{
  division?: string; // Optional division name to filter by (e.g., "Atlantic", "Metropolitan")
}
```

### get-schedule

Get NHL game schedule.

```typescript
{
  teamAbbrev?: string; // Optional three-letter team abbreviation to filter by
  date?: string; // Optional date in YYYY-MM-DD format (defaults to today)
}
```

### get-skater-leaders

Get NHL statistical leaders for skaters.

```typescript
{
  category: "points" | "goals" | "assists" | "plusMinus" | "powerPlayGoals" | "gameWinningGoals" | "shots";
  limit?: number; // Optional number of players to return (max 50, default 10)
}
```

## Using with MCP Clients

To use this MCP server with a client, run the server and send JSON-RPC 2.0 requests to its stdin. Below is the format for requests:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "call",
  "params": {
    "name": "get-team",
    "input": {
      "teamAbbrev": "TOR"
    }
  }
}
```

The server will respond with results in JSON format.

## NHL API Endpoints Used

This MCP server utilizes the following NHL API endpoints:

- Team information: `/roster/{team}/current` and `/club-stats/{team}/now`
- Player information: `/player/{playerId}/landing` and `/player/{playerId}/game-log/now`
- Standings: `/standings/now`
- Schedule: `/schedule/now` and `/club-schedule/{team}/week/now`
- Stats leaders: `/skater-stats-leaders/current`

For more detailed NHL API documentation, see [docs/RAWDOC.md](docs/RAWDOC.md).

## License

MIT