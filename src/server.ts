import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const NHL_WEB_API_BASE = "https://api-web.nhle.com/v1";
const NHL_STATS_API_BASE = "https://api.nhle.com/stats/rest/en";
const USER_AGENT = "nhl-stats-app/1.0";

// Create server instance
const server = new McpServer({
  name: "nhl-api",
  version: "1.0.0",
});

// Helper function for making NHL API requests
async function makeNHLRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making NHL request:", error);
    return null;
  }
}

// Types for NHL API responses
interface TeamResponse {
  teamId?: number;
  name?: string;
  abbrev?: string;
  locationName?: string;
  teamName?: string;
  division?: { name: string; shortName: string; };
  conference?: { name: string; shortName: string; };
  roster?: PlayerResponse[];
  record?: {
    wins: number;
    losses: number;
    otLosses: number;
    points: number;
  };
}

interface PlayerResponse {
  playerId?: number;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  position?: string;
  sweaterNumber?: number;
  birthDate?: string;
  birthCity?: string;
  birthCountry?: string;
  height?: string;
  weight?: number;
  teamId?: number;
  shootsCatches?: string;
  rookie?: boolean;
}

interface StandingsResponse {
  standings?: {
    divisionStandings?: {
      divisionName?: string;
      conferenceAbbrev?: string;
      teamRecords?: StandingsRecord[];
    }[];
  };
}

interface StandingsRecord {
  teamId?: number;
  teamName?: {
    default: string;
  };
  teamAbbrev?: {
    default: string;
  };
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  otLosses?: number;
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  homeRecord?: string;
  awayRecord?: string;
  streakCode?: string;
  streakCount?: number;
}

interface ScheduleResponse {
  gameWeek?: {
    date?: string;
    dayAbbrev?: string;
    numberOfGames?: number;
    games?: GameResponse[];
  }[];
}

interface GameResponse {
  id?: number;
  season?: string;
  gameType?: number;
  gameDate?: string;
  venue?: {
    default: string;
  };
  startTimeUTC?: string;
  homeTeam?: {
    id: number;
    name: string;
    abbrev: string;
    score: number;
  };
  awayTeam?: {
    id: number;
    name: string;
    abbrev: string;
    score: number;
  };
  gameState?: string;
  gameScheduleState?: string;
}

// Register NHL API tools
server.tool(
  "get-team",
  "Get information about an NHL team",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
  },
  async ({ teamAbbrev }: { teamAbbrev: string }) => {
    const teamCode = teamAbbrev.toUpperCase();
    const teamUrl = `${NHL_WEB_API_BASE}/roster/${teamCode}/current`;
    const teamData = await makeNHLRequest<TeamResponse>(teamUrl);

    if (!teamData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve data for team: ${teamCode}`,
          },
        ],
      };
    }

    // Get team stats
    const statsUrl = `${NHL_WEB_API_BASE}/club-stats/${teamCode}/now`;
    const statsData = await makeNHLRequest<any>(statsUrl);

    let teamInfo = [
      `Team: ${teamData.name || `${teamData.locationName} ${teamData.teamName}`}`,
      `Abbreviation: ${teamData.abbrev}`,
      `Division: ${teamData.division?.name}`,
      `Conference: ${teamData.conference?.name}`,
    ];

    if (statsData && statsData.teamStats) {
      const stats = statsData.teamStats[0];
      teamInfo = [
        ...teamInfo,
        "Stats:",
        `  Record: ${stats.wins}-${stats.losses}-${stats.otLosses}`,
        `  Points: ${stats.points}`,
        `  Goals For: ${stats.goalsFor}`,
        `  Goals Against: ${stats.goalsAgainst}`,
        `  Home Record: ${stats.homeRecordL10}`,
        `  Away Record: ${stats.awayRecordL10}`,
      ];
    }

    return {
      content: [
        {
          type: "text",
          text: teamInfo.join("\\n"),
        },
      ],
    };
  },
);

server.tool(
  "get-player",
  "Get information about an NHL player",
  {
    playerId: z.number().describe("NHL player ID (e.g. 8478402 for Connor McDavid)"),
  },
  async ({ playerId }: { playerId: number }) => {
    const playerUrl = `${NHL_WEB_API_BASE}/player/${playerId}/landing`;
    const playerData = await makeNHLRequest<PlayerResponse>(playerUrl);

    if (!playerData) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve data for player ID: ${playerId}`,
          },
        ],
      };
    }

    // Get player stats
    const statsUrl = `${NHL_WEB_API_BASE}/player/${playerId}/game-log/now`;
    const statsData = await makeNHLRequest<any>(statsUrl);

    const playerInfo = [
      `Name: ${playerData.fullName || `${playerData.firstName} ${playerData.lastName}`}`,
      `Position: ${playerData.position}`,
      `Jersey Number: ${playerData.sweaterNumber}`,
      `Team: ${playerData.teamId}`,
      `Birth Date: ${playerData.birthDate || "Unknown"}`,
      `Birth Place: ${playerData.birthCity}, ${playerData.birthCountry}`,
      `Height: ${playerData.height}`,
      `Weight: ${playerData.weight} lbs`,
      `Shoots/Catches: ${playerData.shootsCatches}`,
      `Rookie: ${playerData.rookie ? "Yes" : "No"}`,
    ];

    if (statsData && statsData.stats) {
      const isGoalie = playerData.position === "G";
      const stats = statsData.stats;
      
      if (isGoalie) {
        playerInfo.push(
          "Season Stats (Goalie):",
          `  Games Played: ${stats.gamesPlayed || 0}`,
          `  Wins: ${stats.wins || 0}`,
          `  Losses: ${stats.losses || 0}`,
          `  OT Losses: ${stats.otLosses || 0}`,
          `  Save Percentage: ${stats.savePctg || 0}`,
          `  Goals Against Average: ${stats.goalsAgainstAverage || 0}`,
          `  Shutouts: ${stats.shutouts || 0}`
        );
      } else {
        playerInfo.push(
          "Season Stats (Skater):",
          `  Games Played: ${stats.gamesPlayed || 0}`,
          `  Goals: ${stats.goals || 0}`,
          `  Assists: ${stats.assists || 0}`,
          `  Points: ${stats.points || 0}`,
          `  Plus/Minus: ${stats.plusMinus || 0}`,
          `  Penalty Minutes: ${stats.pim || 0}`,
          `  Power Play Goals: ${stats.powerPlayGoals || 0}`,
          `  Game Winning Goals: ${stats.gameWinningGoals || 0}`,
          `  Shots: ${stats.shots || 0}`,
          `  Shooting Percentage: ${stats.shootingPctg || 0}%`
        );
      }
    }

    return {
      content: [
        {
          type: "text",
          text: playerInfo.join("\\n"),
        },
      ],
    };
  },
);

server.tool(
  "get-standings",
  "Get current NHL standings",
  {
    division: z.string().optional().describe("Division name to filter by (e.g. 'Atlantic', 'Metropolitan', 'Central', 'Pacific')"),
  },
  async ({ division }: { division?: string }) => {
    const standingsUrl = `${NHL_WEB_API_BASE}/standings/now`;
    const standingsData = await makeNHLRequest<StandingsResponse>(standingsUrl);

    if (!standingsData || !standingsData.standings) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve NHL standings",
          },
        ],
      };
    }

    let divisions = standingsData.standings.divisionStandings || [];
    
    // Filter by division if provided
    if (division) {
      divisions = divisions.filter(
        div => div.divisionName?.toLowerCase() === division.toLowerCase()
      );
      
      if (divisions.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No standings found for division: ${division}`,
            },
          ],
        };
      }
    }

    // Format standings by division
    const formattedStandings = divisions.map(div => {
      const teams = div.teamRecords || [];
      const teamRows = teams.map(team => {
        return [
          `${team.teamAbbrev?.default.padEnd(5)} | `,
          `${team.gamesPlayed?.toString().padStart(2)} | `,
          `${team.wins?.toString().padStart(2)}-`,
          `${team.losses?.toString().padStart(2)}-`,
          `${team.otLosses?.toString().padStart(2)} | `,
          `${team.points?.toString().padStart(3)} pts | `,
          `${team.goalsFor?.toString().padStart(3)} GF | `,
          `${team.goalsAgainst?.toString().padStart(3)} GA | `,
          `${team.streakCode}${team.streakCount}`,
        ].join("");
      });

      return [
        `${div.divisionName} Division (${div.conferenceAbbrev} Conference):`,
        "Team  | GP | Record   | PTS | GF  | GA  | Streak",
        "------+----+----------+-----+-----+-----+-------",
        ...teamRows,
        "",
      ].join("\\n");
    });

    return {
      content: [
        {
          type: "text",
          text: formattedStandings.join("\\n"),
        },
      ],
    };
  },
);

server.tool(
  "get-schedule",
  "Get NHL game schedule",
  {
    teamAbbrev: z.string().length(3).optional().describe("Three-letter team abbreviation to filter by (e.g. TOR, NYR)"),
    date: z.string().optional().describe("Date in YYYY-MM-DD format (defaults to today)"),
  },
  async ({ teamAbbrev, date }: { teamAbbrev?: string; date?: string }) => {
    let scheduleUrl;
    
    if (teamAbbrev) {
      const teamCode = teamAbbrev.toUpperCase();
      scheduleUrl = date 
        ? `${NHL_WEB_API_BASE}/club-schedule/${teamCode}/week/${date}`
        : `${NHL_WEB_API_BASE}/club-schedule/${teamCode}/week/now`;
    } else {
      scheduleUrl = date
        ? `${NHL_WEB_API_BASE}/schedule/${date}`
        : `${NHL_WEB_API_BASE}/schedule/now`;
    }
    
    const scheduleData = await makeNHLRequest<ScheduleResponse>(scheduleUrl);

    if (!scheduleData || !scheduleData.gameWeek) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve NHL schedule",
          },
        ],
      };
    }

    const gameWeeks = scheduleData.gameWeek || [];
    
    if (gameWeeks.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No games scheduled for the requested period",
          },
        ],
      };
    }

    // Format schedule
    const formattedSchedule = gameWeeks.map(day => {
      const games = day.games || [];
      const gameList = games.map(game => {
        const homeTeam = game.homeTeam;
        const awayTeam = game.awayTeam;
        const startTime = game.startTimeUTC ? new Date(game.startTimeUTC).toLocaleTimeString() : "TBD";
        
        let gameInfo = `${awayTeam?.abbrev} @ ${homeTeam?.abbrev} - ${startTime}`;
        
        // Add score if game has started/completed
        if (game.gameState === "LIVE" || game.gameState === "FINAL") {
          gameInfo += ` (${awayTeam?.score} - ${homeTeam?.score})`;
          gameInfo += game.gameState === "FINAL" ? " FINAL" : " LIVE";
        }
        
        return gameInfo;
      });

      return [
        `${day.date} (${day.dayAbbrev}) - ${day.numberOfGames} games:`,
        ...gameList,
        "",
      ].join("\\n");
    });

    return {
      content: [
        {
          type: "text",
          text: formattedSchedule.join("\\n"),
        },
      ],
    };
  },
);

server.tool(
  "get-skater-leaders",
  "Get NHL statistical leaders for skaters",
  {
    category: z.enum(["points", "goals", "assists", "plusMinus", "powerPlayGoals", "gameWinningGoals", "shots"])
      .describe("Statistical category to get leaders for"),
    limit: z.number().min(1).max(50).default(10).describe("Number of players to return (max 50)"),
  },
  async ({ category, limit }: { category: string; limit: number }) => {
    const leadersUrl = `${NHL_WEB_API_BASE}/skater-stats-leaders/current?categories=${category}&limit=${limit}`;
    const leadersData = await makeNHLRequest<any>(leadersUrl);

    if (!leadersData || !leadersData.categories || leadersData.categories.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve leaders for category: ${category}`,
          },
        ],
      };
    }

    const categoryData = leadersData.categories[0];
    const leaders = categoryData.leaders || [];
    
    if (leaders.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No leaders found for category: ${category}`,
          },
        ],
      };
    }

    // Format leaders
    const headerText = `NHL Leaders - ${categoryData.categoryLabel || category} (${leadersData.season})`;
    const leaderRows = leaders.map((leader: any, index: number) => {
      return [
        `${(index + 1).toString().padStart(2)}. `,
        `${leader.fullName.padEnd(25)} | `,
        `${leader.teamAbbrev.padEnd(4)} | `,
        `${leader.value}`,
      ].join("");
    });

    return {
      content: [
        {
          type: "text",
          text: [
            headerText,
            "".padEnd(headerText.length, "="),
            ...leaderRows,
          ].join("\\n"),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("NHL API MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});