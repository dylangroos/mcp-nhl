# NHL API - Model Context Protocol

A TypeScript implementation of the NHL API using the Model-Context Protocol pattern. This MCP server provides access to NHL data including teams, players, standings, schedules, and statistics.

## Overview

This library provides a clean interface to the NHL's official APIs using the Model-Context Protocol (MCP). It allows you to fetch data from the NHL's APIs and provides it in a structured, easy-to-use format through MCP tools.

## 📊 Current State

As of March 10, 2025, the platform provides the following functionality:

### ✅ Working Features

1. **Standings**
   - League-wide standings with division breakdowns
   - Complete team record information

2. **Teams**
   - Basic team identity information 
   - Current roster information with player details
   - Team statistics (skaters and goalies)
   - Prospect tracking

3. **Players**
   - Player biographical information
   - Current season and career statistics
   - Award recognition

4. **Schedules**
   - Current team schedules
   - Date-specific league schedules
   - Upcoming game information

5. **Statistics**
   - Current statistical leaders (skaters and goalies)
   - Team-specific statistical breakdowns

6. **Game Information**
   - Live game scores and status
   - Game schedules

### ❌ Issues Identified

1. **Team Information Gaps**
   - Team division and conference information missing in team lookup
   - Basic team data incomplete (city/location details absent)

2. **Game Details**
   - Limited game state information for in-progress games
   - Play-by-play data implementation needs further testing

3. **Historical Data**
   - Seasonal historical data access needs verification
   - Historical schedule retrieval requires additional testing

4. **UI Integration**
   - No current UI components for data visualization
   - Raw data format requires transformation for frontend display

## 📝 TODO List

### High Priority

- [ ] Fix team information API to include complete team details (division, conference, location)
- [ ] Implement more detailed game state tracking for live games
- [ ] Create data transformation layers for UI integration
- [ ] Complete testing of historical data endpoints

### Medium Priority

- [ ] Develop standard data visualization components
- [ ] Add player image integration
- [ ] Implement team logo/brand assets
- [ ] Create search functionality across all data types

### Low Priority

- [ ] Build caching system for frequently accessed data
- [ ] Add fantasy hockey integration points
- [ ] Develop news/media integration
- [ ] Add social media content connections

## 🚀 Getting Started

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/nhl-mcp.git
   cd nhl-mcp
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure API credentials:
   ```
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. Start the development server:
   ```
   npm run dev
   ```

## 🔧 API Reference

The NHL-MCP platform provides the following core API endpoints:

### Teams
- `get-team`: Retrieve basic team information
- `get-team-roster`: Get current team roster
- `get-team-stats`: Get team statistics
- `get-team-prospects`: Get team prospect information

### Players
- `get-player-landing`: Get detailed player information

### Standings
- `get-current-standings`: Get current NHL standings

### Schedule
- `get-schedule`: Get general schedule information
- `get-current-schedule`: Get a team's upcoming schedule
- `get-date-schedule`: Get schedule for a specific date

### Statistics
- `get-current-stat-leaders`: Get current statistical leaders
- `get-current-goalie-leaders`: Get current goalie statistical leaders

### Games
- `get-scores-now`: Get current scores and game states

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Contact

Project Maintainer: Dylan Groos

---

*Note: This README documents the current state of the NHL-MCP project based on testing conducted on March 10, 2025. The platform accesses NHL data which is subject to terms and conditions set by the National Hockey League.*
