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
  isActive?: boolean;
  currentTeamId?: number;
  currentTeamAbbrev?: string;
  fullTeamName?: {
    default: string;
    fr?: string;
  };
  teamCommonName?: {
    default: string;
  };
  teamPlaceNameWithPreposition?: {
    default: string;
    fr?: string;
  };
  firstName?: {
    default: string;
  };
  lastName?: {
    default: string;
  };
  badges?: Array<{
    logoUrl?: {
      default: string;
      fr?: string;
    };
    title?: {
      default: string;
      fr?: string;
    };
  }>;
  teamLogo?: string;
  sweaterNumber?: number;
  position?: string;
  headshot?: string;
  heroImage?: string;
  heightInInches?: number;
  heightInCentimeters?: number;
  weightInPounds?: number;
  weightInKilograms?: number;
  birthDate?: string;
  birthCity?: {
    default: string;
  };
  birthStateProvince?: {
    default: string;
  };
  birthCountry?: string;
  shootsCatches?: string;
  draftDetails?: {
    year?: number;
    teamAbbrev?: string;
    round?: number;
    pickInRound?: number;
    overallPick?: number;
  };
  playerSlug?: string;
  featuredStats?: {
    season?: number;
    regularSeason?: {
      subSeason?: {
        assists?: number;
        gameWinningGoals?: number;
        gamesPlayed?: number;
        goals?: number;
        otGoals?: number;
        pim?: number;
        plusMinus?: number;
        points?: number;
        powerPlayGoals?: number;
        powerPlayPoints?: number;
        shootingPctg?: number;
        shorthandedGoals?: number;
        shorthandedPoints?: number;
        shots?: number;
        wins?: number;
        losses?: number;
        otLosses?: number;
        savePctg?: number;
        goalsAgainstAverage?: number;
        shutouts?: number;
      };
      career?: {
        assists?: number;
        gameWinningGoals?: number;
        gamesPlayed?: number;
        goals?: number;
        otGoals?: number;
        pim?: number;
        plusMinus?: number;
        points?: number;
        powerPlayGoals?: number;
        powerPlayPoints?: number;
        shootingPctg?: number;
        shorthandedGoals?: number;
        shorthandedPoints?: number;
        shots?: number;
      };
    };
  };
  careerTotals?: {
    regularSeason?: any;
    playoffs?: any;
  };
  last5Games?: Array<any>;
  seasonTotals?: Array<any>;
  awards?: Array<any>;
  currentTeamRoster?: Array<any>;
}

interface StandingsResponse {
  wildCardIndicator?: boolean;
  standingsDateTimeUtc?: string;
  standings?: {
    conferenceAbbrev?: string;
    conferenceName?: string;
    divisionAbbrev?: string;
    divisionName?: string;
    teamName?: {
      default: string;
    };
    teamCommonName?: {
      default: string;
    };
    teamAbbrev?: {
      default: string;
    };
    placeName?: {
      default: string;
    };
    wins?: number;
    losses?: number;
    otLosses?: number;
    points?: number;
    goalsFor?: number;
    goalAgainst?: number;
    teamLogo?: string;
  }[];
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
  "get-current-standings",
  "Get current NHL standings",
  {},
  async () => {
    const standings = await makeNHLRequest<StandingsResponse>(`${NHL_WEB_API_BASE}/standings/now`);
    
    if (!standings) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve NHL standings. The NHL API might be unavailable.",
          },
        ],
      };
    }
    
    // Format standings for display
    const formattedStandings = [];
    
    if (standings.standings && standings.standings.length > 0) {
      // Group by division
      const divisionMap = new Map();
      
      for (const team of standings.standings) {
        const divisionName = team.divisionName || "Unknown Division";
        if (!divisionMap.has(divisionName)) {
          divisionMap.set(divisionName, []);
        }
        divisionMap.get(divisionName).push(team);
      }
      
      // Format each division
      for (const [division, teams] of divisionMap.entries()) {
        formattedStandings.push(`\n## ${division} Division`);
        formattedStandings.push("Team | GP | W | L | OTL | PTS | GF | GA");
        formattedStandings.push("-----|----|----|----|----|-----|----|----|");
        
        // Sort teams by points
        teams.sort((a: any, b: any) => (b.points || 0) - (a.points || 0));
        
        for (const team of teams) {
          const teamName = team.teamName?.default || "Unknown";
          const gp = (team.wins || 0) + (team.losses || 0) + (team.otLosses || 0);
          formattedStandings.push(
            `${teamName} | ${gp} | ${team.wins || 0} | ${team.losses || 0} | ${team.otLosses || 0} | ${team.points || 0} | ${team.goalsFor || 0} | ${team.goalAgainst || 0}`
          );
        }
      }
    } else {
      formattedStandings.push("No standings data available.");
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedStandings.join("\n"),
        },
      ],
    };
  }
);
server.tool(
  "get-team",
  "Get information about an NHL team",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
  },
  async ({ teamAbbrev }: { teamAbbrev: string }) => {
    const teamCode = teamAbbrev.toUpperCase().trim();
    console.error(`Getting information for team: ${teamCode}`);
    
    // List of endpoints to try in order
    const endpoints = [
      {
        name: "Team Info API",
        url: `${NHL_STATS_API_BASE}/team`,
        parseTeam: (data: any): TeamResponse => {
          console.error("Team Info API data keys:", Object.keys(data));
          const teams = data.data || [];
          const matchingTeam = teams.find((t: any) => 
            t.triCode === teamCode || 
            t.rawTricode === teamCode || 
            t.abbrev === teamCode || 
            t.teamAbbrev?.default === teamCode
          );
          
          if (!matchingTeam) {
            console.error("No matching team found in team info data");
            return {};
          }
          
          return {
            teamId: matchingTeam.id || matchingTeam.teamId,
            name: matchingTeam.fullName || matchingTeam.name,
            abbrev: teamCode,
            locationName: matchingTeam.locationName,
            teamName: matchingTeam.teamName,
            division: { 
              name: matchingTeam.divisionName || (matchingTeam.division && matchingTeam.division.name) || "Unknown",
              shortName: matchingTeam.divisionAbbrev || (matchingTeam.division && matchingTeam.division.nameShort) || ""
            },
            conference: { 
              name: matchingTeam.conferenceName || (matchingTeam.conference && matchingTeam.conference.name) || "Unknown",
              shortName: matchingTeam.conferenceAbbrev || (matchingTeam.conference && matchingTeam.conference.nameShort) || ""
            }
          };
        }
      },
      {
        name: "Standings API",
        url: `${NHL_WEB_API_BASE}/standings/now`,
        parseTeam: (data: any): TeamResponse => {
          console.error("Standings API data keys:", Object.keys(data));
          let foundTeam;
          
          // Navigate through possible data structures
          const standings = data.standings || [];
          
          for (const team of standings) {
            if (team.teamAbbrev?.default === teamCode || 
                team.abbrev === teamCode || 
                team.triCode === teamCode) {
              foundTeam = team;
              break;
            }
          }
          
          if (!foundTeam) {
            console.error("No matching team found in standings data");
            return {};
          }
          
          return {
            teamId: foundTeam.teamId || foundTeam.id,
            name: (foundTeam.teamName && foundTeam.teamName.default) || foundTeam.name,
            abbrev: teamCode,
            locationName: foundTeam.placeName?.default,
            teamName: foundTeam.teamCommonName?.default,
            division: { 
              name: foundTeam.divisionName || "Unknown Division", 
              shortName: foundTeam.divisionAbbrev || "" 
            },
            conference: { 
              name: foundTeam.conferenceName || 
                   (foundTeam.conferenceAbbrev === "E" ? "Eastern" : 
                   foundTeam.conferenceAbbrev === "W" ? "Western" : "Unknown"), 
              shortName: foundTeam.conferenceAbbrev || "" 
            },
            record: {
              wins: foundTeam.wins || 0,
              losses: foundTeam.losses || 0,
              otLosses: foundTeam.otLosses || 0,
              points: foundTeam.points || 0,
            }
          };
        }
      }
    ];
    
    // Try each endpoint until we get valid team data
    let teamData: TeamResponse = {};
    let errorMessages = [];
    
    for (const endpoint of endpoints) {
      try {
        console.error(`Trying ${endpoint.name} endpoint: ${endpoint.url}`);
        const data = await makeNHLRequest<any>(endpoint.url);
        
        if (data) {
          console.error(`Got response from ${endpoint.name}`);
          const parsedTeam = endpoint.parseTeam(data);
          
          // Merge with existing data, keeping non-empty values
          teamData = { 
            ...teamData, 
            ...Object.fromEntries(
              Object.entries(parsedTeam).filter(([_, v]) => v !== undefined && v !== null)
            ) 
          };
          
          // If we have essential data, we can stop trying more endpoints
          if (teamData.name && teamData.division && teamData.conference) {
            console.error(`Got complete team data from ${endpoint.name}`);
            break;
          }
        }
      } catch (error) {
        const message = `Error with ${endpoint.name}: ${error}`;
        console.error(message);
        errorMessages.push(message);
      }
    }

    // Verify we have the minimum required data
    if (!teamData.name) {
      console.error(`Failed to retrieve data for team: ${teamCode}. Errors: ${errorMessages.join("; ")}`);
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve data for team: ${teamCode}. The team code may be invalid or NHL API might be unavailable.`,
          },
        ],
      };
    }

    // Get team stats
    const statsUrl = `${NHL_WEB_API_BASE}/club-stats/${teamCode}/now`;
    const statsData = await makeNHLRequest<any>(statsUrl);
    
    // Construct the team name properly
    const teamFullName = teamData.name || 
                        (teamData.locationName && teamData.teamName) ? 
                        `${teamData.locationName} ${teamData.teamName}` : 
                        `${teamCode} (name unavailable)`;

    let teamInfo = [
      `Team: ${teamFullName}`,
      `Abbreviation: ${teamCode}`,
      `Division: ${teamData.division?.name || "Not available"}`,
      `Conference: ${teamData.conference?.name || "Not available"}`,
    ];

    if (statsData && statsData.teamStats && statsData.teamStats.length > 0) {
      const stats = statsData.teamStats[0];
      teamInfo = [
        ...teamInfo,
        "Stats:",
        `  Record: ${stats.wins}-${stats.losses}-${stats.otLosses}`,
        `  Points: ${stats.points}`,
        `  Goals For: ${stats.goalsFor}`,
        `  Goals Against: ${stats.goalsAgainst}`,
        `  Home Record: ${stats.homeRecord || stats.homeRecordL10 || "N/A"}`,
        `  Away Record: ${stats.awayRecord || stats.awayRecordL10 || "N/A"}`,
      ];
    } else if (teamData.record) {
      // Fallback to basic record data from standings
      teamInfo = [
        ...teamInfo,
        "Stats:",
        `  Record: ${teamData.record.wins}-${teamData.record.losses}-${teamData.record.otLosses}`,
        `  Points: ${teamData.record.points}`,
      ];
    }

    return {
      content: [
        {
          type: "text",
          text: teamInfo.join("\n"),
        },
      ],
    };
  },
);

server.tool(
  "get-team-roster",
  "Get information about an NHL team's current roster",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
    seasonAbbrev: z.string().describe("Season code (e.g. 20242025 for the 2024-2025 season)"),
  },
  async ({ teamAbbrev, seasonAbbrev }: { teamAbbrev: string; seasonAbbrev: string }) => {
    const teamCode = teamAbbrev.toUpperCase();
    const seasonCode = seasonAbbrev;
    
    console.error(`Getting roster for team: ${teamCode} in season: ${seasonCode}`);
    
    // Fetch roster data from NHL API
    const rosterUrl = `${NHL_WEB_API_BASE}/roster/${teamCode}/${seasonCode}`;
    let rosterData = null;
    
    try {
      console.error(`Fetching roster from: ${rosterUrl}`);
      rosterData = await makeNHLRequest<any>(rosterUrl);
      
      if (!rosterData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve roster for ${teamCode} in season ${seasonCode}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching roster: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving roster for ${teamCode} in season ${seasonCode}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format player information
    const formatPlayer = (player: any): string => {
      const name = `${safeString(player.firstName)} ${safeString(player.lastName)}`;
      const number = player.sweaterNumber ? `#${player.sweaterNumber}` : "";
      const position = player.positionCode || "";
      const height = player.heightInInches ? 
        `${Math.floor(player.heightInInches / 12)}'${player.heightInInches % 12}"` : 
        "N/A";
      const weight = player.weightInPounds ? `${player.weightInPounds} lbs` : "N/A";
      
      return `${name} ${number} (${position}) - ${height}, ${weight}`;
    };
    
    // Build the roster display
    const rosterDisplay = [];
    
    // Add team header
    rosterDisplay.push(`# ${teamCode} Roster - ${seasonCode} Season\n`);
    
    // Add forwards
    if (rosterData.forwards && rosterData.forwards.length > 0) {
      rosterDisplay.push("## Forwards");
      rosterData.forwards.forEach((player: any) => {
        rosterDisplay.push(formatPlayer(player));
      });
      rosterDisplay.push("");
    }
    
    // Add defensemen
    if (rosterData.defensemen && rosterData.defensemen.length > 0) {
      rosterDisplay.push("## Defensemen");
      rosterData.defensemen.forEach((player: any) => {
        rosterDisplay.push(formatPlayer(player));
      });
      rosterDisplay.push("");
    }
    
    // Add goalies
    if (rosterData.goalies && rosterData.goalies.length > 0) {
      rosterDisplay.push("## Goalies");
      rosterData.goalies.forEach((player: any) => {
        rosterDisplay.push(formatPlayer(player));
      });
      rosterDisplay.push("");
    }
    
    // Add roster summary
    const totalPlayers = 
      (rosterData.forwards?.length || 0) + 
      (rosterData.defensemen?.length || 0) + 
      (rosterData.goalies?.length || 0);
    
    rosterDisplay.push(`Total players: ${totalPlayers}`);
    
    return {
      content: [
        {
          type: "text",
          text: rosterDisplay.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-team-stats",
  "Get statistics for an NHL team",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
  },
  async ({ teamAbbrev }: { teamAbbrev: string }) => {
    return {
      content: [
        {
          type: "text",
          text: `Team stats for ${teamAbbrev} will be implemented soon.`,
        },
      ],
    };
  }
);

server.tool(
  "get-player-landing",
  "Get information about an NHL player",
  {
    playerId: z.number().describe("NHL player ID (e.g. 8478402 for Connor McDavid)"),
  },
  async ({ playerId }: { playerId: number }) => {
    console.error(`Getting information for player ID: ${playerId}`);
    
    // Use only the Player Landing API since it's the one that works
    const playerLandingUrl = `${NHL_WEB_API_BASE}/player/${playerId}/landing`;
    let playerData: PlayerResponse | null = null;
    let errorMessage = "";
    
    try {
      console.error(`Trying Player Landing API: ${playerLandingUrl}`);
      const data = await makeNHLRequest<any>(playerLandingUrl);
      
      if (data) {
        console.error("Got response from Player Landing API");
        playerData = data;
        console.error("Got player data from Player Landing API");
      }
    } catch (error) {
      errorMessage = `Error with Player Landing API: ${error}`;
      console.error(errorMessage);
    }

    if (!playerData) {
      console.error(`Failed to retrieve data for player ID: ${playerId}. Error: ${errorMessage}`);
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve data for player ID: ${playerId}. The player ID may be invalid or NHL API might be unavailable.`,
          },
        ],
      };
    }

    // Get player stats if not already included
    if (!playerData.featuredStats) {
      const statsUrl = `${NHL_WEB_API_BASE}/player/${playerId}/game-log/now`;
      try {
        const statsData = await makeNHLRequest<any>(statsUrl);
        console.error("Retrieved player stats data");
        if (statsData && statsData.stats) {
          playerData.featuredStats = {
            regularSeason: {
              subSeason: statsData.stats
            }
          };
        }
      } catch (error) {
        console.error("Error retrieving player stats:", error);
      }
    }
    
    // Get their team information if not already included
    let teamName = playerData.fullTeamName?.default || "Unknown Team";
    let teamAbbrev = playerData.currentTeamAbbrev || "";
    
    // Safe string extraction functions to prevent [object Object] issues
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue; // Return default for objects/arrays
    };
    
    // Format the player's name properly
    let playerName = `${safeString(playerData.firstName)} ${safeString(playerData.lastName)}`;
    if (playerName.trim() === '') {
      playerName = playerData.playerSlug || `Player #${playerId}`;
    }
    
    // Format the birth place properly
    const birthCity = safeString(playerData.birthCity, "Unknown City");
    const birthStateProvince = safeString(playerData.birthStateProvince, "");
    const birthCountry = safeString(playerData.birthCountry, "Unknown Country");
    const birthPlace = `${birthCity}${birthStateProvince ? ', ' + birthStateProvince : ''}${birthCountry !== "Unknown Country" ? ', ' + birthCountry : ''}`;

    // Format height
    const height = playerData.heightInInches ? 
      `${Math.floor(playerData.heightInInches / 12)}'${playerData.heightInInches % 12}" (${playerData.heightInCentimeters || Math.round(playerData.heightInInches * 2.54)} cm)` : 
      "N/A";
    
    // Format weight
    const weight = playerData.weightInPounds ? 
      `${playerData.weightInPounds} lbs (${playerData.weightInKilograms || Math.round(playerData.weightInPounds * 0.453592)} kg)` : 
      "N/A";

    const playerInfo = [
      `Name: ${playerName}`,
      `Position: ${safeString(playerData.position, "Unknown")}`,
      `Jersey Number: ${safeString(playerData.sweaterNumber, "N/A")}`,
      `Team: ${teamName}`,
      `Birth Date: ${safeString(playerData.birthDate, "Unknown")}`,
      `Birth Place: ${birthPlace}`,
      `Height: ${height}`,
      `Weight: ${weight}`,
      `Shoots/Catches: ${safeString(playerData.shootsCatches, "N/A")}`,
    ];

    // Add draft information if available
    if (playerData.draftDetails) {
      const draft = playerData.draftDetails;
      if (draft.year) {
        playerInfo.push(
          `Draft: ${draft.year} Round ${draft.round || 'N/A'}, Pick ${draft.overallPick || 'N/A'} (${draft.teamAbbrev || 'N/A'})`
        );
      }
    }

    // Add current season stats if available
    if (playerData.featuredStats?.regularSeason?.subSeason) {
      const stats = playerData.featuredStats.regularSeason.subSeason;
      const isGoalie = playerData.position === "G";
      
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
          `  Shooting Percentage: ${stats.shootingPctg ? `${stats.shootingPctg * 100}%` : "0%"}`
        );
      }
    }

    // Add career stats if available
    if (playerData.featuredStats?.regularSeason?.career) {
      const career = playerData.featuredStats.regularSeason.career;
      playerInfo.push(
        "Career Stats:",
        `  Games Played: ${career.gamesPlayed || 0}`,
        `  Goals: ${career.goals || 0}`,
        `  Assists: ${career.assists || 0}`,
        `  Points: ${career.points || 0}`
      );
    }

    // Add awards if available
    if (playerData.awards && playerData.awards.length > 0) {
      playerInfo.push("Awards:");
      for (const award of playerData.awards) {
        playerInfo.push(`  ${safeString(award.trophy)}`);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: playerInfo.join("\n"),
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
      ].join("\n");
    });

    return {
      content: [
        {
          type: "text",
          text: formattedSchedule.join("\n"),
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
    console.error(`Getting statistical leaders for category: ${category}, limit: ${limit}`);
    
    // Define the set of URLs to try in order of preference
    const urls = [
      // Primary NHL web API
      {
        url: `${NHL_WEB_API_BASE}/skater-stats-leaders/current?categories=${category}&limit=${limit}`,
        format: "web",
        extract: (data: any) => {
          if (!data || !data.categories || data.categories.length === 0) {
            console.error("No categories in web API response");
            return null;
          }
          
          const categoryData = data.categories.find((c: any) => 
            c.categoryName?.toLowerCase() === category.toLowerCase() ||
            c.categoryLabel?.toLowerCase() === category.toLowerCase()
          ) || data.categories[0];
          
          return {
            leaders: categoryData.leaders || [],
            categoryLabel: categoryData.categoryLabel || category,
            season: data.season || 'current'
          };
        }
      },
      // Secondary stats API direct endpoint
      {
        url: `${NHL_STATS_API_BASE}/leaders/skaters/${category}?limit=${limit}`,
        format: "stats-direct",
        extract: (data: any) => {
          if (!data || !data.data) {
            console.error("No data in stats API response");
            return null;
          }
          
          return {
            leaders: data.data,
            categoryLabel: data.description || category,
            season: data.season || 'current'
          };
        }
      },
      // Skater stats with filter as last resort
      {
        url: `${NHL_STATS_API_BASE}/skater/summary?limit=${limit}&sort=${category}&cayenneExp=seasonId=20242025`,
        format: "stats-filtered",
        extract: (data: any) => {
          if (!data || !data.data) {
            console.error("No data in filtered stats API response");
            return null;
          }
          
          return {
            leaders: data.data,
            categoryLabel: category,
            season: '2024-2025'
          };
        }
      }
    ];
    
    // Try all URLs in sequence
    let result = null;
    let errors = [];
    
    for (const endpoint of urls) {
      try {
        console.error(`Trying to fetch leader data from: ${endpoint.url}`);
        const data = await makeNHLRequest<any>(endpoint.url);
        
        if (!data) {
          console.error(`No data returned from ${endpoint.url}`);
          continue;
        }
        
        console.error(`Got response from ${endpoint.format} format endpoint`);
        const extracted = endpoint.extract(data);
        
        if (extracted && extracted.leaders && extracted.leaders.length > 0) {
          result = extracted;
          console.error(`Successfully extracted ${extracted.leaders.length} leaders using ${endpoint.format} format`);
          break;
        } else {
          console.error(`Failed to extract leaders from ${endpoint.format} format`);
        }
      } catch (error) {
        const message = `Error with ${endpoint.format} endpoint: ${error}`;
        console.error(message);
        errors.push(message);
      }
    }
    
    // If we couldn't get any data
    if (!result) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve ${category} leaders. The NHL API endpoints may be unavailable or the category name may be invalid. Valid categories are: points, goals, assists, plusMinus, powerPlayGoals, gameWinningGoals, shots.`,
          },
        ],
      };
    }
    
    const { leaders, categoryLabel, season } = result;
    
    // Extra safety check
    if (leaders.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No statistical leaders found for category: ${category}`,
          },
        ],
      };
    }

    // Safe string extraction function to prevent object serialization issues
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return defaultValue;
    };

    // Format leaders
    const headerText = `NHL Leaders - ${categoryLabel} (${season})`;
    const leaderRows = leaders.map((leader: any, index: number) => {
      // Handle different API formats with safe string extraction
      let name = 'Unknown Player';
      
      if (typeof leader.fullName === 'string') {
        name = leader.fullName;
      } else if (typeof leader.skaterFullName === 'string') {
        name = leader.skaterFullName;
      } else if (leader.firstName && leader.lastName) {
        name = `${safeString(leader.firstName)} ${safeString(leader.lastName)}`;
      } else {
        name = `Player #${leader.playerId || leader.id || index+1}`;
      }
      
      // Extract team abbreviation safely
      let team = 'N/A';
      if (typeof leader.teamAbbrev === 'string') {
        team = leader.teamAbbrev;
      } else if (typeof leader.teamAbbrevs === 'string') {
        team = leader.teamAbbrevs;
      } else if (leader.team && typeof leader.team.triCode === 'string') {
        team = leader.team.triCode;
      } else if (leader.team && typeof leader.team.abbrev === 'string') {
        team = leader.team.abbrev;
      }
      
      // Extract value based on category
      let value = '0';
      if (leader.value !== undefined) {
        value = safeString(leader.value);
      } else if (category === 'points' && leader.points !== undefined) {
        value = safeString(leader.points);
      } else if (category === 'goals' && leader.goals !== undefined) {
        value = safeString(leader.goals);
      } else if (category === 'assists' && leader.assists !== undefined) {
        value = safeString(leader.assists);
      } else if (category === 'plusMinus' && leader.plusMinus !== undefined) {
        value = safeString(leader.plusMinus);
      } else if (leader[category] !== undefined) {
        value = safeString(leader[category]);
      }
      
      return [
        `${(index + 1).toString().padStart(2)}. `,
        `${name.padEnd(25)} | `,
        `${team.padEnd(4)} | `,
        `${value}`,
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
          ].join("\n"),
        },
      ],
    };
  },
);

server.tool(
  "get-current-stat-leaders",
  "Get current NHL skater stats leaders",
  {
    category: z.string().describe("Stat category (e.g. goals, assists, points)"),
    limit: z.number().optional().describe("Number of players to return (default: 5)"),
  },
  async ({ category, limit = 5 }: { category: string; limit?: number }) => {
    console.error(`Getting stats leaders for category: ${category}, limit: ${limit}`);
    
    // Fetch stats leaders data from NHL API
    const leadersUrl = `${NHL_WEB_API_BASE}/skater-stats-leaders/current?categories=${category}&limit=${limit}`;
    let leadersData = null;
    
    try {
      console.error(`Fetching stats leaders from: ${leadersUrl}`);
      leadersData = await makeNHLRequest<any>(leadersUrl);
      
      if (!leadersData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve stats leaders for category: ${category}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching stats leaders: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving stats leaders for category: ${category}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Check if we have data for the requested category
    if (!leadersData[category] || !Array.isArray(leadersData[category]) || leadersData[category].length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No data found for category: ${category}. Available categories may include: goals, assists, points, etc.`,
          },
        ],
      };
    }
    
    // Format the leaders data
    const leaders = leadersData[category];
    const formattedLeaders = [];
    
    // Add header
    formattedLeaders.push(`# NHL ${category.charAt(0).toUpperCase() + category.slice(1)} Leaders\n`);
    
    // Add table header
    formattedLeaders.push("| Rank | Player | Team | Pos | Value |");
    formattedLeaders.push("|------|--------|------|-----|-------|");
    
    // Add each player
    leaders.forEach((player: any, index: number) => {
      const rank = index + 1;
      const name = `${safeString(player.firstName)} ${safeString(player.lastName)}`;
      const team = safeString(player.teamAbbrev);
      const position = safeString(player.position);
      const value = player.value !== undefined ? player.value : "N/A";
      
      formattedLeaders.push(`| ${rank} | ${name} | ${team} | ${position} | ${value} |`);
    });
    
    return {
      content: [
        {
          type: "text",
          text: formattedLeaders.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-season-stat-leaders",
  "Get NHL skater stats leaders for a specific season and game type",
  {
    category: z.string().describe("Stat category (e.g. goals, assists, points)"),
    season: z.string().describe("Season in YYYYYYYY format (e.g. 20232024)"),
    gameType: z.number().default(2).describe("Game type (2 for regular season, 3 for playoffs)"),
    limit: z.number().optional().describe("Number of players to return (default: 5)"),
  },
  async ({ category, season, gameType = 2, limit = 5 }: { category: string; season: string; gameType?: number; limit?: number }) => {
    console.error(`Getting stats leaders for category: ${category}, season: ${season}, gameType: ${gameType}, limit: ${limit}`);
    
    // Fetch stats leaders data from NHL API
    const leadersUrl = `${NHL_WEB_API_BASE}/skater-stats-leaders/${season}/${gameType}?categories=${category}&limit=${limit}`;
    let leadersData = null;
    
    try {
      console.error(`Fetching stats leaders from: ${leadersUrl}`);
      leadersData = await makeNHLRequest<any>(leadersUrl);
      
      if (!leadersData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve stats leaders for category: ${category}, season: ${season}, gameType: ${gameType}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching stats leaders: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving stats leaders for category: ${category}, season: ${season}, gameType: ${gameType}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Check if we have data for the requested category
    if (!leadersData[category] || !Array.isArray(leadersData[category]) || leadersData[category].length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No data found for category: ${category}, season: ${season}, gameType: ${gameType}. Available categories may include: goals, assists, points, etc.`,
          },
        ],
      };
    }
    
    // Format the leaders data
    const leaders = leadersData[category];
    const formattedLeaders = [];
    
    // Add header
    const seasonFormatted = `${season.substring(0, 4)}-${season.substring(4)}`;
    const gameTypeText = gameType === 2 ? "Regular Season" : gameType === 3 ? "Playoffs" : `Game Type ${gameType}`;
    formattedLeaders.push(`# NHL ${category.charAt(0).toUpperCase() + category.slice(1)} Leaders - ${seasonFormatted} ${gameTypeText}\n`);
    
    // Add table header
    formattedLeaders.push("| Rank | Player | Team | Pos | Value |");
    formattedLeaders.push("|------|--------|------|-----|-------|");
    
    // Add each player
    leaders.forEach((player: any, index: number) => {
      const rank = index + 1;
      const name = `${safeString(player.firstName)} ${safeString(player.lastName)}`;
      const team = safeString(player.teamAbbrev);
      const position = safeString(player.position);
      const value = player.value !== undefined ? player.value : "N/A";
      
      formattedLeaders.push(`| ${rank} | ${name} | ${team} | ${position} | ${value} |`);
    });
    
    return {
      content: [
        {
          type: "text",
          text: formattedLeaders.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-current-goalie-leaders",
  "Get current NHL goalie stats leaders",
  {
    category: z.string().describe("Stat category (e.g. wins, savePctg, gaa, shutouts)"),
    limit: z.number().optional().describe("Number of goalies to return (default: 5)"),
  },
  async ({ category, limit = 5 }: { category: string; limit?: number }) => {
    console.error(`Getting goalie stats leaders for category: ${category}, limit: ${limit}`);
    
    // Fetch goalie stats leaders data from NHL API
    const leadersUrl = `${NHL_WEB_API_BASE}/goalie-stats-leaders/current?categories=${category}&limit=${limit}`;
    let leadersData = null;
    
    try {
      console.error(`Fetching goalie stats leaders from: ${leadersUrl}`);
      leadersData = await makeNHLRequest<any>(leadersUrl);
      
      if (!leadersData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve goalie stats leaders for category: ${category}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching goalie stats leaders: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving goalie stats leaders for category: ${category}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Check if we have data for the requested category
    if (!leadersData[category] || !Array.isArray(leadersData[category]) || leadersData[category].length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No data found for category: ${category}. Available categories may include: wins, savePctg, gaa, shutouts, etc.`,
          },
        ],
      };
    }
    
    // Format the leaders data
    const leaders = leadersData[category];
    const formattedLeaders = [];
    
    // Add header
    const categoryDisplay = category === "savePctg" ? "Save Percentage" : 
                           category === "gaa" ? "Goals Against Average" : 
                           category.charAt(0).toUpperCase() + category.slice(1);
    formattedLeaders.push(`# NHL Goalie ${categoryDisplay} Leaders\n`);
    
    // Add table header
    formattedLeaders.push("| Rank | Goalie | Team | Value | GP |");
    formattedLeaders.push("|------|--------|------|-------|-----|");
    
    // Add each goalie
    leaders.forEach((goalie: any, index: number) => {
      const rank = index + 1;
      const name = `${safeString(goalie.firstName)} ${safeString(goalie.lastName)}`;
      const team = safeString(goalie.teamAbbrev);
      const value = goalie.value !== undefined ? 
                   (category === "savePctg" ? goalie.value.toFixed(3) : goalie.value) : 
                   "N/A";
      const gamesPlayed = goalie.gamesPlayed !== undefined ? goalie.gamesPlayed : "N/A";
      
      formattedLeaders.push(`| ${rank} | ${name} | ${team} | ${value} | ${gamesPlayed} |`);
    });
    
    return {
      content: [
        {
          type: "text",
          text: formattedLeaders.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-season-goalie-leaders",
  "Get NHL goalie stats leaders for a specific season and game type",
  {
    category: z.string().describe("Stat category (e.g. wins, savePctg, gaa, shutouts)"),
    season: z.string().describe("Season in YYYYYYYY format (e.g. 20232024)"),
    gameType: z.number().default(2).describe("Game type (2 for regular season, 3 for playoffs)"),
    limit: z.number().optional().describe("Number of goalies to return (default: 5)"),
  },
  async ({ category, season, gameType = 2, limit = 5 }: { category: string; season: string; gameType?: number; limit?: number }) => {
    console.error(`Getting goalie stats leaders for category: ${category}, season: ${season}, gameType: ${gameType}, limit: ${limit}`);
    
    // Fetch goalie stats leaders data from NHL API
    const leadersUrl = `${NHL_WEB_API_BASE}/goalie-stats-leaders/${season}/${gameType}?categories=${category}&limit=${limit}`;
    let leadersData = null;
    
    try {
      console.error(`Fetching goalie stats leaders from: ${leadersUrl}`);
      leadersData = await makeNHLRequest<any>(leadersUrl);
      
      if (!leadersData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve goalie stats leaders for category: ${category}, season: ${season}, gameType: ${gameType}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching goalie stats leaders: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving goalie stats leaders for category: ${category}, season: ${season}, gameType: ${gameType}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Check if we have data for the requested category
    if (!leadersData[category] || !Array.isArray(leadersData[category]) || leadersData[category].length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No data found for category: ${category}, season: ${season}, gameType: ${gameType}. Available categories may include: wins, savePctg, gaa, shutouts, etc.`,
          },
        ],
      };
    }
    
    // Format the leaders data
    const leaders = leadersData[category];
    const formattedLeaders = [];
    
    // Add header
    const seasonFormatted = `${season.substring(0, 4)}-${season.substring(4)}`;
    const gameTypeText = gameType === 2 ? "Regular Season" : gameType === 3 ? "Playoffs" : `Game Type ${gameType}`;
    const categoryDisplay = category === "savePctg" ? "Save Percentage" : 
                           category === "gaa" ? "Goals Against Average" : 
                           category.charAt(0).toUpperCase() + category.slice(1);
    formattedLeaders.push(`# NHL Goalie ${categoryDisplay} Leaders - ${seasonFormatted} ${gameTypeText}\n`);
    
    // Add table header
    formattedLeaders.push("| Rank | Goalie | Team | Value | GP |");
    formattedLeaders.push("|------|--------|------|-------|-----|");
    
    // Add each goalie
    leaders.forEach((goalie: any, index: number) => {
      const rank = index + 1;
      const name = `${safeString(goalie.firstName)} ${safeString(goalie.lastName)}`;
      const team = safeString(goalie.teamAbbrev);
      const value = goalie.value !== undefined ? 
                   (category === "savePctg" ? goalie.value.toFixed(3) : goalie.value) : 
                   "N/A";
      const gamesPlayed = goalie.gamesPlayed !== undefined ? goalie.gamesPlayed : "N/A";
      
      formattedLeaders.push(`| ${rank} | ${name} | ${team} | ${value} | ${gamesPlayed} |`);
    });
    
    return {
      content: [
        {
          type: "text",
          text: formattedLeaders.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-current-team-stats",
  "Get current statistics for an NHL team",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
  },
  async ({ teamAbbrev }: { teamAbbrev: string }) => {
    console.error(`Getting current stats for team: ${teamAbbrev}`);
    
    // Fetch team stats data from NHL API
    const statsUrl = `${NHL_WEB_API_BASE}/club-stats/${teamAbbrev}/now`;
    let statsData = null;
    
    try {
      console.error(`Fetching team stats from: ${statsUrl}`);
      statsData = await makeNHLRequest<any>(statsUrl);
      
      if (!statsData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve current stats for team: ${teamAbbrev}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching team stats: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving current stats for team: ${teamAbbrev}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the team stats data
    const formattedStats = [];
    
    // Add team header
    formattedStats.push(`# ${teamAbbrev} Current Team Statistics\n`);
    
    // Add season info if available
    if (statsData.season) {
      const seasonFormatted = `${statsData.season.substring(0, 4)}-${statsData.season.substring(4)}`;
      formattedStats.push(`Season: ${seasonFormatted}`);
    }
    
    // Add team record if available
    if (statsData.wins !== undefined && statsData.losses !== undefined && statsData.otLosses !== undefined) {
      const points = statsData.points !== undefined ? statsData.points : (statsData.wins * 2 + statsData.otLosses);
      formattedStats.push(`Record: ${statsData.wins}-${statsData.losses}-${statsData.otLosses} (${points} points)\n`);
    }
    
    // Add skater stats section
    if (statsData.skaters && statsData.skaters.length > 0) {
      formattedStats.push(`## Skaters (${statsData.skaters.length})\n`);
      
      // Add table header for skaters
      formattedStats.push("| Player | Pos | GP | G | A | P | +/- | PIM | PPG | SHG | GWG | S | S% |");
      formattedStats.push("|--------|-----|----|----|----|----|-----|-----|-----|-----|-----|----|----|");
      
      // Sort skaters by points (descending)
      const sortedSkaters = [...statsData.skaters].sort((a, b) => (b.points || 0) - (a.points || 0));
      
      // Add each skater
      sortedSkaters.forEach((skater) => {
        const firstName = safeString(skater.firstName?.default, "");
        const lastName = safeString(skater.lastName?.default, "");
        const name = `${firstName} ${lastName}`.trim();
        const position = safeString(skater.positionCode, "");
        const gamesPlayed = skater.gamesPlayed !== undefined ? skater.gamesPlayed : "0";
        const goals = skater.goals !== undefined ? skater.goals : "0";
        const assists = skater.assists !== undefined ? skater.assists : "0";
        const points = skater.points !== undefined ? skater.points : "0";
        const plusMinus = skater.plusMinus !== undefined ? (skater.plusMinus > 0 ? `+${skater.plusMinus}` : skater.plusMinus) : "0";
        const pim = skater.penaltyMinutes !== undefined ? skater.penaltyMinutes : "0";
        const ppg = skater.powerPlayGoals !== undefined ? skater.powerPlayGoals : "0";
        const shg = skater.shorthandedGoals !== undefined ? skater.shorthandedGoals : "0";
        const gwg = skater.gameWinningGoals !== undefined ? skater.gameWinningGoals : "0";
        const shots = skater.shots !== undefined ? skater.shots : "0";
        const shootingPct = skater.shootingPctg !== undefined ? skater.shootingPctg.toFixed(1) : "0.0";
        
        formattedStats.push(`| ${name} | ${position} | ${gamesPlayed} | ${goals} | ${assists} | ${points} | ${plusMinus} | ${pim} | ${ppg} | ${shg} | ${gwg} | ${shots} | ${shootingPct} |`);
      });
      
      formattedStats.push("");
    }
    
    // Add goalie stats section
    if (statsData.goalies && statsData.goalies.length > 0) {
      formattedStats.push(`## Goalies (${statsData.goalies.length})\n`);
      
      // Add table header for goalies
      formattedStats.push("| Goalie | GP | GS | W | L | OTL | GAA | SV% | SO |");
      formattedStats.push("|--------|----|----|---|---|-----|-----|-----|---|");
      
      // Sort goalies by games played (descending)
      const sortedGoalies = [...statsData.goalies].sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0));
      
      // Add each goalie
      sortedGoalies.forEach((goalie) => {
        const firstName = safeString(goalie.firstName?.default, "");
        const lastName = safeString(goalie.lastName?.default, "");
        const name = `${firstName} ${lastName}`.trim();
        const gamesPlayed = goalie.gamesPlayed !== undefined ? goalie.gamesPlayed : "0";
        const gamesStarted = goalie.gamesStarted !== undefined ? goalie.gamesStarted : "0";
        const wins = goalie.wins !== undefined ? goalie.wins : "0";
        const losses = goalie.losses !== undefined ? goalie.losses : "0";
        const otLosses = goalie.overtimeLosses !== undefined ? goalie.overtimeLosses : "0";
        const gaa = goalie.goalsAgainstAverage !== undefined ? goalie.goalsAgainstAverage.toFixed(2) : "0.00";
        const svPct = goalie.savePercentage !== undefined ? goalie.savePercentage.toFixed(3) : "0.000";
        const shutouts = goalie.shutouts !== undefined ? goalie.shutouts : "0";
        
        formattedStats.push(`| ${name} | ${gamesPlayed} | ${gamesStarted} | ${wins} | ${losses} | ${otLosses} | ${gaa} | ${svPct} | ${shutouts} |`);
      });
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedStats.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-team-stats-seasons",
  "Get available seasons with statistics for an NHL team",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
  },
  async ({ teamAbbrev }: { teamAbbrev: string }) => {
    console.error(`Getting available stats seasons for team: ${teamAbbrev}`);
    
    // Fetch team stats seasons data from NHL API
    const seasonsUrl = `${NHL_WEB_API_BASE}/club-stats-season/${teamAbbrev}`;
    let seasonsData = null;
    
    try {
      console.error(`Fetching team stats seasons from: ${seasonsUrl}`);
      seasonsData = await makeNHLRequest<any>(seasonsUrl);
      
      if (!seasonsData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve available stats seasons for team: ${teamAbbrev}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching team stats seasons: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving available stats seasons for team: ${teamAbbrev}: ${error}`,
          },
        ],
      };
    }
    
    // Format the seasons data
    const formattedSeasons = [];
    
    // Add header
    formattedSeasons.push(`# ${teamAbbrev} Available Statistics Seasons\n`);
    
    // Check if we have seasons data
    if (!seasonsData.seasons || !Array.isArray(seasonsData.seasons) || seasonsData.seasons.length === 0) {
      formattedSeasons.push("No seasons data available for this team.");
      return {
        content: [
          {
            type: "text",
            text: formattedSeasons.join("\n"),
          },
        ],
      };
    }
    
    // Add table header
    formattedSeasons.push("| Season | Game Types Available |");
    formattedSeasons.push("|--------|----------------------|");
    
    // Add each season
    seasonsData.seasons.forEach((season: any) => {
      const seasonCode = season.season || "N/A";
      const seasonFormatted = `${seasonCode.substring(0, 4)}-${seasonCode.substring(4)}`;
      
      // Format game types
      let gameTypes = "None";
      if (season.gameTypes && Array.isArray(season.gameTypes) && season.gameTypes.length > 0) {
        gameTypes = season.gameTypes.map((gt: any) => {
          const gameTypeId = gt.gameTypeId;
          // Map game type IDs to readable names
          switch (gameTypeId) {
            case 1: return "Preseason";
            case 2: return "Regular Season";
            case 3: return "Playoffs";
            case 4: return "All-Star";
            default: return `Type ${gameTypeId}`;
          }
        }).join(", ");
      }
      
      formattedSeasons.push(`| ${seasonFormatted} | ${gameTypes} |`);
    });
    
    return {
      content: [
        {
          type: "text",
          text: formattedSeasons.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-team-stats-by-season",
  "Get statistics for an NHL team for a specific season and game type",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
    season: z.string().describe("Season in YYYYYYYY format (e.g. 20232024)"),
    gameType: z.number().default(2).describe("Game type (2 for regular season, 3 for playoffs)"),
  },
  async ({ teamAbbrev, season, gameType = 2 }: { teamAbbrev: string; season: string; gameType?: number }) => {
    console.error(`Getting stats for team: ${teamAbbrev}, season: ${season}, gameType: ${gameType}`);
    
    // Fetch team stats data from NHL API
    const statsUrl = `${NHL_WEB_API_BASE}/club-stats/${teamAbbrev}/${season}/${gameType}`;
    let statsData = null;
    
    try {
      console.error(`Fetching team stats from: ${statsUrl}`);
      statsData = await makeNHLRequest<any>(statsUrl);
      
      if (!statsData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve stats for team: ${teamAbbrev}, season: ${season}, gameType: ${gameType}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching team stats: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving stats for team: ${teamAbbrev}, season: ${season}, gameType: ${gameType}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the team stats data
    const formattedStats = [];
    
    // Add team header
    const seasonFormatted = `${season.substring(0, 4)}-${season.substring(4)}`;
    const gameTypeText = gameType === 2 ? "Regular Season" : gameType === 3 ? "Playoffs" : `Game Type ${gameType}`;
    formattedStats.push(`# ${teamAbbrev} Team Statistics - ${seasonFormatted} ${gameTypeText}\n`);
    
    // Add team record if available
    if (statsData.wins !== undefined && statsData.losses !== undefined && statsData.otLosses !== undefined) {
      const points = statsData.points !== undefined ? statsData.points : (statsData.wins * 2 + statsData.otLosses);
      formattedStats.push(`Record: ${statsData.wins}-${statsData.losses}-${statsData.otLosses} (${points} points)\n`);
    }
    
    // Add skater stats section
    if (statsData.skaters && statsData.skaters.length > 0) {
      formattedStats.push(`## Skaters (${statsData.skaters.length})\n`);
      
      // Add table header for skaters
      formattedStats.push("| Player | Pos | GP | G | A | P | +/- | PIM | PPG | SHG | GWG | S | S% |");
      formattedStats.push("|--------|-----|----|----|----|----|-----|-----|-----|-----|-----|----|----|");
      
      // Sort skaters by points (descending)
      const sortedSkaters = [...statsData.skaters].sort((a, b) => (b.points || 0) - (a.points || 0));
      
      // Add each skater
      sortedSkaters.forEach((skater) => {
        const firstName = safeString(skater.firstName?.default, "");
        const lastName = safeString(skater.lastName?.default, "");
        const name = `${firstName} ${lastName}`.trim();
        const position = safeString(skater.positionCode, "");
        const gamesPlayed = skater.gamesPlayed !== undefined ? skater.gamesPlayed : "0";
        const goals = skater.goals !== undefined ? skater.goals : "0";
        const assists = skater.assists !== undefined ? skater.assists : "0";
        const points = skater.points !== undefined ? skater.points : "0";
        const plusMinus = skater.plusMinus !== undefined ? (skater.plusMinus > 0 ? `+${skater.plusMinus}` : skater.plusMinus) : "0";
        const pim = skater.penaltyMinutes !== undefined ? skater.penaltyMinutes : "0";
        const ppg = skater.powerPlayGoals !== undefined ? skater.powerPlayGoals : "0";
        const shg = skater.shorthandedGoals !== undefined ? skater.shorthandedGoals : "0";
        const gwg = skater.gameWinningGoals !== undefined ? skater.gameWinningGoals : "0";
        const shots = skater.shots !== undefined ? skater.shots : "0";
        const shootingPct = skater.shootingPctg !== undefined ? skater.shootingPctg.toFixed(1) : "0.0";
        
        formattedStats.push(`| ${name} | ${position} | ${gamesPlayed} | ${goals} | ${assists} | ${points} | ${plusMinus} | ${pim} | ${ppg} | ${shg} | ${gwg} | ${shots} | ${shootingPct} |`);
      });
      
      formattedStats.push("");
    }
    
    // Add goalie stats section
    if (statsData.goalies && statsData.goalies.length > 0) {
      formattedStats.push(`## Goalies (${statsData.goalies.length})\n`);
      
      // Add table header for goalies
      formattedStats.push("| Goalie | GP | GS | W | L | OTL | GAA | SV% | SO |");
      formattedStats.push("|--------|----|----|---|---|-----|-----|-----|---|");
      
      // Sort goalies by games played (descending)
      const sortedGoalies = [...statsData.goalies].sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0));
      
      // Add each goalie
      sortedGoalies.forEach((goalie) => {
        const firstName = safeString(goalie.firstName?.default, "");
        const lastName = safeString(goalie.lastName?.default, "");
        const name = `${firstName} ${lastName}`.trim();
        const gamesPlayed = goalie.gamesPlayed !== undefined ? goalie.gamesPlayed : "0";
        const gamesStarted = goalie.gamesStarted !== undefined ? goalie.gamesStarted : "0";
        const wins = goalie.wins !== undefined ? goalie.wins : "0";
        const losses = goalie.losses !== undefined ? goalie.losses : "0";
        const otLosses = goalie.overtimeLosses !== undefined ? goalie.overtimeLosses : "0";
        const gaa = goalie.goalsAgainstAverage !== undefined ? goalie.goalsAgainstAverage.toFixed(2) : "0.00";
        const svPct = goalie.savePercentage !== undefined ? goalie.savePercentage.toFixed(3) : "0.000";
        const shutouts = goalie.shutouts !== undefined ? goalie.shutouts : "0";
        
        formattedStats.push(`| ${name} | ${gamesPlayed} | ${gamesStarted} | ${wins} | ${losses} | ${otLosses} | ${gaa} | ${svPct} | ${shutouts} |`);
      });
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedStats.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-roster-by-season",
  "Get an NHL team's roster for a specific season",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
    season: z.string().describe("Season in YYYYYYYY format (e.g. 20232024)"),
  },
  async ({ teamAbbrev, season }: { teamAbbrev: string; season: string }) => {
    console.error(`Getting roster for team: ${teamAbbrev}, season: ${season}`);
    
    // Fetch roster data from NHL API
    const rosterUrl = `${NHL_WEB_API_BASE}/roster/${teamAbbrev}/${season}`;
    let rosterData = null;
    
    try {
      console.error(`Fetching roster from: ${rosterUrl}`);
      rosterData = await makeNHLRequest<any>(rosterUrl);
      
      if (!rosterData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve roster for team: ${teamAbbrev}, season: ${season}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching roster: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving roster for team: ${teamAbbrev}, season: ${season}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the roster data
    const formattedRoster = [];
    const seasonFormatted = `${season.substring(0, 4)}-${season.substring(4)}`;
    
    // Add header
    formattedRoster.push(`# ${teamAbbrev} Roster - ${seasonFormatted} Season\n`);
    
    // Process forwards
    if (rosterData.forwards && rosterData.forwards.length > 0) {
      formattedRoster.push(`## Forwards (${rosterData.forwards.length})\n`);
      formattedRoster.push("| # | Player | Pos | Shoots | Height | Weight | Birth Date | Birthplace |");
      formattedRoster.push("|---|--------|-----|--------|--------|--------|------------|------------|");
      
      // Sort forwards by jersey number
      const sortedForwards = [...rosterData.forwards].sort((a, b) => (a.sweaterNumber || 999) - (b.sweaterNumber || 999));
      
      sortedForwards.forEach(player => {
        const number = player.sweaterNumber || "-";
        const firstName = safeString(player.firstName?.default, "");
        const lastName = safeString(player.lastName?.default, "");
        const name = `${firstName} ${lastName}`.trim();
        const position = safeString(player.positionCode, "");
        const shoots = player.shootsCatches === "L" ? "Left" : player.shootsCatches === "R" ? "Right" : player.shootsCatches || "-";
        
        // Format height as feet and inches
        let height = "-";
        if (player.heightInInches) {
          const feet = Math.floor(player.heightInInches / 12);
          const inches = player.heightInInches % 12;
          height = `${feet}'${inches}"`;
        }
        
        // Format weight
        const weight = player.weightInPounds ? `${player.weightInPounds} lbs` : "-";
        
        // Format birth date
        let birthDate = "-";
        if (player.birthDate) {
          const date = new Date(player.birthDate);
          birthDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        
        // Format birthplace
        const birthCity = safeString(player.birthCity, "");
        const birthState = safeString(player.birthStateProvince, "");
        const birthCountry = player.birthCountry || "";
        let birthplace = "";
        
        if (birthCity) {
          birthplace += birthCity;
          if (birthState) birthplace += `, ${birthState}`;
          if (birthCountry) birthplace += `, ${birthCountry}`;
        } else if (birthCountry) {
          birthplace = birthCountry;
        } else {
          birthplace = "-";
        }
        
        formattedRoster.push(`| ${number} | ${name} | ${position} | ${shoots} | ${height} | ${weight} | ${birthDate} | ${birthplace} |`);
      });
      
      formattedRoster.push("");
    }
    
    // Process defensemen
    if (rosterData.defensemen && rosterData.defensemen.length > 0) {
      formattedRoster.push(`## Defensemen (${rosterData.defensemen.length})\n`);
      formattedRoster.push("| # | Player | Shoots | Height | Weight | Birth Date | Birthplace |");
      formattedRoster.push("|---|--------|--------|--------|--------|------------|------------|");
      
      // Sort defensemen by jersey number
      const sortedDefensemen = [...rosterData.defensemen].sort((a, b) => (a.sweaterNumber || 999) - (b.sweaterNumber || 999));
      
      sortedDefensemen.forEach(player => {
        const number = player.sweaterNumber || "-";
        const firstName = safeString(player.firstName?.default, "");
        const lastName = safeString(player.lastName?.default, "");
        const name = `${firstName} ${lastName}`.trim();
        const shoots = player.shootsCatches === "L" ? "Left" : player.shootsCatches === "R" ? "Right" : player.shootsCatches || "-";
        
        // Format height as feet and inches
        let height = "-";
        if (player.heightInInches) {
          const feet = Math.floor(player.heightInInches / 12);
          const inches = player.heightInInches % 12;
          height = `${feet}'${inches}"`;
        }
        
        // Format weight
        const weight = player.weightInPounds ? `${player.weightInPounds} lbs` : "-";
        
        // Format birth date
        let birthDate = "-";
        if (player.birthDate) {
          const date = new Date(player.birthDate);
          birthDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        
        // Format birthplace
        const birthCity = safeString(player.birthCity, "");
        const birthState = safeString(player.birthStateProvince, "");
        const birthCountry = player.birthCountry || "";
        let birthplace = "";
        
        if (birthCity) {
          birthplace += birthCity;
          if (birthState) birthplace += `, ${birthState}`;
          if (birthCountry) birthplace += `, ${birthCountry}`;
        } else if (birthCountry) {
          birthplace = birthCountry;
        } else {
          birthplace = "-";
        }
        
        formattedRoster.push(`| ${number} | ${name} | ${shoots} | ${height} | ${weight} | ${birthDate} | ${birthplace} |`);
      });
      
      formattedRoster.push("");
    }
    
    // Process goalies
    if (rosterData.goalies && rosterData.goalies.length > 0) {
      formattedRoster.push(`## Goalies (${rosterData.goalies.length})\n`);
      formattedRoster.push("| # | Goalie | Catches | Height | Weight | Birth Date | Birthplace |");
      formattedRoster.push("|---|--------|---------|--------|--------|------------|------------|");
      
      // Sort goalies by jersey number
      const sortedGoalies = [...rosterData.goalies].sort((a, b) => (a.sweaterNumber || 999) - (b.sweaterNumber || 999));
      
      sortedGoalies.forEach(player => {
        const number = player.sweaterNumber || "-";
        const firstName = safeString(player.firstName?.default, "");
        const lastName = safeString(player.lastName?.default, "");
        const name = `${firstName} ${lastName}`.trim();
        const catches = player.shootsCatches === "L" ? "Left" : player.shootsCatches === "R" ? "Right" : player.shootsCatches || "-";
        
        // Format height as feet and inches
        let height = "-";
        if (player.heightInInches) {
          const feet = Math.floor(player.heightInInches / 12);
          const inches = player.heightInInches % 12;
          height = `${feet}'${inches}"`;
        }
        
        // Format weight
        const weight = player.weightInPounds ? `${player.weightInPounds} lbs` : "-";
        
        // Format birth date
        let birthDate = "-";
        if (player.birthDate) {
          const date = new Date(player.birthDate);
          birthDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        
        // Format birthplace
        const birthCity = safeString(player.birthCity, "");
        const birthState = safeString(player.birthStateProvince, "");
        const birthCountry = player.birthCountry || "";
        let birthplace = "";
        
        if (birthCity) {
          birthplace += birthCity;
          if (birthState) birthplace += `, ${birthState}`;
          if (birthCountry) birthplace += `, ${birthCountry}`;
        } else if (birthCountry) {
          birthplace = birthCountry;
        } else {
          birthplace = "-";
        }
        
        formattedRoster.push(`| ${number} | ${name} | ${catches} | ${height} | ${weight} | ${birthDate} | ${birthplace} |`);
      });
    }
    
    // Add roster summary
    const totalPlayers = (rosterData.forwards?.length || 0) + (rosterData.defensemen?.length || 0) + (rosterData.goalies?.length || 0);
    formattedRoster.push(`\n**Total Players:** ${totalPlayers}`);
    
    return {
      content: [
        {
          type: "text",
          text: formattedRoster.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-team-prospects",
  "Get prospects for an NHL team",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
  },
  async ({ teamAbbrev }: { teamAbbrev: string }) => {
    console.error(`Getting prospects for team: ${teamAbbrev}`);
    
    // Fetch prospects data from NHL API
    const prospectsUrl = `${NHL_WEB_API_BASE}/prospects/${teamAbbrev}`;
    let prospectsData = null;
    
    try {
      console.error(`Fetching prospects from: ${prospectsUrl}`);
      prospectsData = await makeNHLRequest<any>(prospectsUrl);
      
      if (!prospectsData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve prospects for team: ${teamAbbrev}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching prospects: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving prospects for team: ${teamAbbrev}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the prospects data
    const formattedProspects = [];
    
    // Add header
    formattedProspects.push(`# ${teamAbbrev} Prospects\n`);
    
    // Process forwards
    if (prospectsData.forwards && prospectsData.forwards.length > 0) {
      formattedProspects.push(`## Forward Prospects (${prospectsData.forwards.length})\n`);
      formattedProspects.push("| Player | Pos | Age | Shoots | Height | Weight | Birthplace |");
      formattedProspects.push("|--------|-----|-----|--------|--------|--------|------------|");
      
      // Sort forwards alphabetically by last name
      const sortedForwards = [...prospectsData.forwards].sort((a, b) => {
        const lastNameA = safeString(a.lastName?.default, "");
        const lastNameB = safeString(b.lastName?.default, "");
        return lastNameA.localeCompare(lastNameB);
      });
      
      sortedForwards.forEach(player => {
        const firstName = safeString(player.firstName?.default, "");
        const lastName = safeString(player.lastName?.default, "");
        const name = `${firstName} ${lastName}`.trim();
        const position = safeString(player.positionCode, "");
        const shoots = player.shootsCatches === "L" ? "Left" : player.shootsCatches === "R" ? "Right" : player.shootsCatches || "-";
        
        // Calculate age
        let age = "-";
        if (player.birthDate) {
          const birthDate = new Date(player.birthDate);
          const today = new Date();
          let calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
          }
          age = String(calculatedAge);
        }
        
        // Format height as feet and inches
        let height = "-";
        if (player.heightInInches) {
          const feet = Math.floor(player.heightInInches / 12);
          const inches = player.heightInInches % 12;
          height = `${feet}'${inches}"`;
        }
        
        // Format weight
        const weight = player.weightInPounds ? `${player.weightInPounds} lbs` : "-";
        
        // Format birthplace
        const birthCity = safeString(player.birthCity, "");
        const birthState = safeString(player.birthStateProvince, "");
        const birthCountry = player.birthCountry || "";
        let birthplace = "";
        
        if (birthCity) {
          birthplace += birthCity;
          if (birthState) birthplace += `, ${birthState}`;
          if (birthCountry) birthplace += `, ${birthCountry}`;
        } else if (birthCountry) {
          birthplace = birthCountry;
        } else {
          birthplace = "-";
        }
        
        formattedProspects.push(`| ${name} | ${position} | ${age} | ${shoots} | ${height} | ${weight} | ${birthplace} |`);
      });
      
      formattedProspects.push("");
    }
    
    // Process defensemen
    if (prospectsData.defensemen && prospectsData.defensemen.length > 0) {
      formattedProspects.push(`## Defensive Prospects (${prospectsData.defensemen.length})\n`);
      formattedProspects.push("| Player | Age | Shoots | Height | Weight | Birthplace |");
      formattedProspects.push("|--------|-----|--------|--------|--------|------------|");
      
      // Sort defensemen alphabetically by last name
      const sortedDefensemen = [...prospectsData.defensemen].sort((a, b) => {
        const lastNameA = safeString(a.lastName?.default, "");
        const lastNameB = safeString(b.lastName?.default, "");
        return lastNameA.localeCompare(lastNameB);
      });
      
      sortedDefensemen.forEach(player => {
        const firstName = safeString(player.firstName?.default, "");
        const lastName = safeString(player.lastName?.default, "");
        const name = `${firstName} ${lastName}`.trim();
        const shoots = player.shootsCatches === "L" ? "Left" : player.shootsCatches === "R" ? "Right" : player.shootsCatches || "-";
        
        // Calculate age
        let age = "-";
        if (player.birthDate) {
          const birthDate = new Date(player.birthDate);
          const today = new Date();
          let calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
          }
          age = String(calculatedAge);
        }
        
        // Format height as feet and inches
        let height = "-";
        if (player.heightInInches) {
          const feet = Math.floor(player.heightInInches / 12);
          const inches = player.heightInInches % 12;
          height = `${feet}'${inches}"`;
        }
        
        // Format weight
        const weight = player.weightInPounds ? `${player.weightInPounds} lbs` : "-";
        
        // Format birthplace
        const birthCity = safeString(player.birthCity, "");
        const birthState = safeString(player.birthStateProvince, "");
        const birthCountry = player.birthCountry || "";
        let birthplace = "";
        
        if (birthCity) {
          birthplace += birthCity;
          if (birthState) birthplace += `, ${birthState}`;
          if (birthCountry) birthplace += `, ${birthCountry}`;
        } else if (birthCountry) {
          birthplace = birthCountry;
        } else {
          birthplace = "-";
        }
        
        formattedProspects.push(`| ${name} | ${age} | ${shoots} | ${height} | ${weight} | ${birthplace} |`);
      });
      
      formattedProspects.push("");
    }
    
    // Process goalies
    if (prospectsData.goalies && prospectsData.goalies.length > 0) {
      formattedProspects.push(`## Goalie Prospects (${prospectsData.goalies.length})\n`);
      formattedProspects.push("| Goalie | Age | Catches | Height | Weight | Birthplace |");
      formattedProspects.push("|--------|-----|---------|--------|--------|------------|");
      
      // Sort goalies alphabetically by last name
      const sortedGoalies = [...prospectsData.goalies].sort((a, b) => {
        const lastNameA = safeString(a.lastName?.default, "");
        const lastNameB = safeString(b.lastName?.default, "");
        return lastNameA.localeCompare(lastNameB);
      });
      
      sortedGoalies.forEach(player => {
        const firstName = safeString(player.firstName?.default, "");
        const lastName = safeString(player.lastName?.default, "");
        const name = `${firstName} ${lastName}`.trim();
        const catches = player.shootsCatches === "L" ? "Left" : player.shootsCatches === "R" ? "Right" : player.shootsCatches || "-";
        
        // Calculate age
        let age = "-";
        if (player.birthDate) {
          const birthDate = new Date(player.birthDate);
          const today = new Date();
          let calculatedAge = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            calculatedAge--;
          }
          age = String(calculatedAge);
        }
        
        // Format height as feet and inches
        let height = "-";
        if (player.heightInInches) {
          const feet = Math.floor(player.heightInInches / 12);
          const inches = player.heightInInches % 12;
          height = `${feet}'${inches}"`;
        }
        
        // Format weight
        const weight = player.weightInPounds ? `${player.weightInPounds} lbs` : "-";
        
        // Format birthplace
        const birthCity = safeString(player.birthCity, "");
        const birthState = safeString(player.birthStateProvince, "");
        const birthCountry = player.birthCountry || "";
        let birthplace = "";
        
        if (birthCity) {
          birthplace += birthCity;
          if (birthState) birthplace += `, ${birthState}`;
          if (birthCountry) birthplace += `, ${birthCountry}`;
        } else if (birthCountry) {
          birthplace = birthCountry;
        } else {
          birthplace = "-";
        }
        
        formattedProspects.push(`| ${name} | ${age} | ${catches} | ${height} | ${weight} | ${birthplace} |`);
      });
    }
    
    // Add prospects summary
    const totalProspects = (prospectsData.forwards?.length || 0) + (prospectsData.defensemen?.length || 0) + (prospectsData.goalies?.length || 0);
    formattedProspects.push(`\n**Total Prospects:** ${totalProspects}`);
    
    // Add note about what prospects are
    formattedProspects.push("\n*Note: Prospects typically include drafted players and young players in development systems who have not yet established themselves as regular NHL players.*");
    
    return {
      content: [
        {
          type: "text",
          text: formattedProspects.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-current-schedule",
  "Get the current NHL schedule for a specific team",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
    limit: z.number().optional().describe("Number of games to return (default: 10)"),
  },
  async ({ teamAbbrev, limit = 10 }: { teamAbbrev: string; limit?: number }) => {
    console.error(`Getting current schedule for team: ${teamAbbrev}, limit: ${limit}`);
    
    const teamCode = teamAbbrev.toUpperCase();
    
    // Fetch schedule data from NHL API
    const scheduleUrl = `${NHL_WEB_API_BASE}/club-schedule/${teamCode}/week/now`;
    let scheduleData = null;
    
    try {
      console.error(`Fetching schedule from: ${scheduleUrl}`);
      scheduleData = await makeNHLRequest<any>(scheduleUrl);
      
      if (!scheduleData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve schedule for team: ${teamCode}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching schedule: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving schedule for team: ${teamCode}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the schedule data
    const formattedSchedule = [];
    
    // Add header
    formattedSchedule.push(`# ${teamCode} Schedule\n`);
    
    // Check if we have games data
    if (!scheduleData.games || !Array.isArray(scheduleData.games) || scheduleData.games.length === 0) {
      formattedSchedule.push("No upcoming games found for this team.");
    } else {
      // Get current and previous season info
      const currentSeason = scheduleData.currentSeason || "N/A";
      const previousSeason = scheduleData.previousSeason || "N/A";
      formattedSchedule.push(`Current Season: ${currentSeason}, Previous Season: ${previousSeason}\n`);
      
      // Add table header
      formattedSchedule.push("| Date | Opponent | Location | Time (ET) | Result |");
      formattedSchedule.push("|------|----------|----------|-----------|--------|");
      
      // Add each game (limited by the limit parameter)
      const games = scheduleData.games.slice(0, limit);
      
      games.forEach((game: any) => {
        // Determine if team is home or away
        const isHome = game.homeTeam && game.homeTeam.abbrev === teamCode;
        const opponent = isHome ? game.awayTeam : game.homeTeam;
        const opponentCode = opponent ? safeString(opponent.abbrev) : "N/A";
        
        // Format date
        const gameDate = game.gameDate ? new Date(game.gameDate).toLocaleDateString() : "N/A";
        
        // Format time
        let gameTime = "N/A";
        if (game.startTimeUTC) {
          try {
            const date = new Date(game.startTimeUTC);
            gameTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            gameTime = "N/A";
          }
        }
        
        // Format location
        const location = isHome ? "Home" : "Away";
        
        // Format result
        let result = "Upcoming";
        if (game.gameState === "FINAL") {
          const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
          const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;
          result = teamScore > opponentScore ? `W ${teamScore}-${opponentScore}` : `L ${teamScore}-${opponentScore}`;
          
          // Check for OT or SO
          if (game.periodDescriptor && game.periodDescriptor.periodType === "OT") {
            result += " (OT)";
          } else if (game.periodDescriptor && game.periodDescriptor.periodType === "SO") {
            result += " (SO)";
          }
        } else if (game.gameState === "LIVE") {
          const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
          const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;
          result = `${teamScore}-${opponentScore} (Live)`;
        }
        
        formattedSchedule.push(`| ${gameDate} | ${opponentCode} | ${location} | ${gameTime} | ${result} |`);
      });
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedSchedule.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-week-schedule",
  "Get the NHL schedule for a specific team for a given week",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
    date: z.string().describe("Date in YYYY-MM-DD format to get the week containing this date"),
  },
  async ({ teamAbbrev, date }: { teamAbbrev: string; date: string }) => {
    console.error(`Getting week schedule for team: ${teamAbbrev}, date: ${date}`);
    
    const teamCode = teamAbbrev.toUpperCase();
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid date format. Please use YYYY-MM-DD format (e.g. 2025-01-15).`,
          },
        ],
      };
    }
    
    // Fetch schedule data from NHL API
    const scheduleUrl = `${NHL_WEB_API_BASE}/club-schedule/${teamCode}/week/${date}`;
    let scheduleData = null;
    
    try {
      console.error(`Fetching week schedule from: ${scheduleUrl}`);
      scheduleData = await makeNHLRequest<any>(scheduleUrl);
      
      if (!scheduleData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve week schedule for team: ${teamCode}, date: ${date}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching week schedule: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving week schedule for team: ${teamCode}, date: ${date}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the schedule data
    const formattedSchedule = [];
    
    // Add header
    formattedSchedule.push(`# ${teamCode} Week Schedule (${date})\n`);
    
    // Check if we have games data
    if (!scheduleData.games || !Array.isArray(scheduleData.games) || scheduleData.games.length === 0) {
      formattedSchedule.push("No games found for this team during the specified week.");
    } else {
      // Get date range for the week
      const firstGame = scheduleData.games[0];
      const lastGame = scheduleData.games[scheduleData.games.length - 1];
      let weekRange = "";
      
      if (firstGame && firstGame.gameDate && lastGame && lastGame.gameDate) {
        const firstDate = new Date(firstGame.gameDate).toLocaleDateString();
        const lastDate = new Date(lastGame.gameDate).toLocaleDateString();
        weekRange = `${firstDate} to ${lastDate}`;
      }
      
      if (weekRange) {
        formattedSchedule.push(`Week: ${weekRange}\n`);
      }
      
      // Add table header
      formattedSchedule.push("| Date | Opponent | Location | Time (ET) | Result |");
      formattedSchedule.push("|------|----------|----------|-----------|--------|");
      
      // Add each game
      scheduleData.games.forEach((game: any) => {
        // Determine if team is home or away
        const isHome = game.homeTeam && game.homeTeam.abbrev === teamCode;
        const opponent = isHome ? game.awayTeam : game.homeTeam;
        const opponentCode = opponent ? safeString(opponent.abbrev) : "N/A";
        
        // Format date
        const gameDate = game.gameDate ? new Date(game.gameDate).toLocaleDateString() : "N/A";
        
        // Format time
        let gameTime = "N/A";
        if (game.startTimeUTC) {
          try {
            const date = new Date(game.startTimeUTC);
            gameTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            gameTime = "N/A";
          }
        }
        
        // Format location
        const location = isHome ? "Home" : "Away";
        
        // Format result
        let result = "Upcoming";
        if (game.gameState === "FINAL" || game.gameState === "OFF") {
          const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
          const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;
          result = teamScore > opponentScore ? `W ${teamScore}-${opponentScore}` : `L ${teamScore}-${opponentScore}`;
          
          // Check for OT or SO
          if (game.periodDescriptor && game.periodDescriptor.periodType === "OT") {
            result += " (OT)";
          } else if (game.periodDescriptor && game.periodDescriptor.periodType === "SO") {
            result += " (SO)";
          }
        } else if (game.gameState === "LIVE") {
          const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
          const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;
          result = `${teamScore}-${opponentScore} (Live)`;
        }
        
        formattedSchedule.push(`| ${gameDate} | ${opponentCode} | ${location} | ${gameTime} | ${result} |`);
      });
      
      // Add summary
      formattedSchedule.push(`\nTotal Games This Week: ${scheduleData.games.length}`);
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedSchedule.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-month-schedule",
  "Get the NHL schedule for a specific team for a given month",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
    year: z.number().describe("Year (e.g. 2025)"),
    month: z.number().min(1).max(12).describe("Month (1-12)"),
  },
  async ({ teamAbbrev, year, month }: { teamAbbrev: string; year: number; month: number }) => {
    console.error(`Getting month schedule for team: ${teamAbbrev}, year: ${year}, month: ${month}`);
    
    const teamCode = teamAbbrev.toUpperCase();
    
    // Validate month
    if (month < 1 || month > 12) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid month. Please provide a month between 1 and 12.`,
          },
        ],
      };
    }
    
    // Format month for API (zero-padded)
    const monthFormatted = month.toString().padStart(2, '0');
    
    // Fetch schedule data from NHL API
    const scheduleUrl = `${NHL_WEB_API_BASE}/club-schedule/${teamCode}/month/${year}-${monthFormatted}-01`;
    let scheduleData = null;
    
    try {
      console.error(`Fetching month schedule from: ${scheduleUrl}`);
      scheduleData = await makeNHLRequest<any>(scheduleUrl);
      
      if (!scheduleData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve month schedule for team: ${teamCode}, year: ${year}, month: ${month}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching month schedule: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving month schedule for team: ${teamCode}, year: ${year}, month: ${month}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the schedule data
    const formattedSchedule = [];
    
    // Get month name
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = monthNames[month - 1];
    
    // Add header
    formattedSchedule.push(`# ${teamCode} Schedule - ${monthName} ${year}\n`);
    
    // Check if we have games data
    if (!scheduleData.games || !Array.isArray(scheduleData.games) || scheduleData.games.length === 0) {
      formattedSchedule.push("No games found for this team during the specified month.");
    } else {
      // Add table header
      formattedSchedule.push("| Date | Opponent | Location | Time (ET) | Result |");
      formattedSchedule.push("|------|----------|----------|-----------|--------|");
      
      // Add each game
      scheduleData.games.forEach((game: any) => {
        // Determine if team is home or away
        const isHome = game.homeTeam && game.homeTeam.abbrev === teamCode;
        const opponent = isHome ? game.awayTeam : game.homeTeam;
        const opponentCode = opponent ? safeString(opponent.abbrev) : "N/A";
        
        // Format date
        const gameDate = game.gameDate ? new Date(game.gameDate).toLocaleDateString() : "N/A";
        
        // Format time
        let gameTime = "N/A";
        if (game.startTimeUTC) {
          try {
            const date = new Date(game.startTimeUTC);
            gameTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          } catch (e) {
            gameTime = "N/A";
          }
        }
        
        // Format location
        const location = isHome ? "Home" : "Away";
        
        // Format result
        let result = "Upcoming";
        if (game.gameState === "FINAL" || game.gameState === "OFF") {
          const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
          const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;
          result = teamScore > opponentScore ? `W ${teamScore}-${opponentScore}` : `L ${teamScore}-${opponentScore}`;
          
          // Check for OT or SO
          if (game.periodDescriptor && game.periodDescriptor.periodType === "OT") {
            result += " (OT)";
          } else if (game.periodDescriptor && game.periodDescriptor.periodType === "SO") {
            result += " (SO)";
          }
        } else if (game.gameState === "LIVE") {
          const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
          const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;
          result = `${teamScore}-${opponentScore} (Live)`;
        }
        
        formattedSchedule.push(`| ${gameDate} | ${opponentCode} | ${location} | ${gameTime} | ${result} |`);
      });
      
      // Add summary
      formattedSchedule.push(`\nTotal Games in ${monthName} ${year}: ${scheduleData.games.length}`);
      
      // Add home/away breakdown
      const homeGames = scheduleData.games.filter((game: any) => game.homeTeam && game.homeTeam.abbrev === teamCode).length;
      const awayGames = scheduleData.games.length - homeGames;
      formattedSchedule.push(`Home Games: ${homeGames}, Away Games: ${awayGames}`);
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedSchedule.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-season-schedule",
  "Get the full season schedule for a specific team",
  {
    teamAbbrev: z.string().length(3).describe("Three-letter team abbreviation (e.g. TOR, NYR, BOS)"),
    season: z.string().describe("Season code (e.g. 20242025 for the 2024-2025 season)"),
    gameType: z.number().optional().default(2).describe("Game type (1 for preseason, 2 for regular season, 3 for playoffs)"),
  },
  async ({ teamAbbrev, season, gameType = 2 }: { teamAbbrev: string; season: string; gameType?: number }) => {
    console.error(`Getting season schedule for team: ${teamAbbrev}, season: ${season}, gameType: ${gameType}`);
    
    const teamCode = teamAbbrev.toUpperCase();
    
    // Fetch schedule data from NHL API
    const scheduleUrl = `${NHL_WEB_API_BASE}/club-schedule/${teamCode}/season/${season}`;
    let scheduleData = null;
    
    try {
      console.error(`Fetching schedule from: ${scheduleUrl}`);
      scheduleData = await makeNHLRequest<any>(scheduleUrl);
      
      if (!scheduleData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve season schedule for team: ${teamCode}, season: ${season}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching season schedule: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving season schedule for team: ${teamCode}, season: ${season}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the schedule data
    const formattedSchedule = [];
    
    // Add header
    formattedSchedule.push(`# ${teamCode} ${season} Season Schedule\n`);
    
    // Check if we have games data
    if (!scheduleData.games || !Array.isArray(scheduleData.games) || scheduleData.games.length === 0) {
      formattedSchedule.push("No games found for this team and season.");
    } else {
      // Filter games by game type if specified
      const filteredGames = scheduleData.games.filter((game: any) => 
        gameType === undefined || game.gameType === gameType
      );
      
      if (filteredGames.length === 0) {
        formattedSchedule.push(`No games found for game type: ${gameType}`);
      } else {
        // Add game type description
        let gameTypeDesc = "Regular Season";
        if (gameType === 1) gameTypeDesc = "Preseason";
        if (gameType === 3) gameTypeDesc = "Playoffs";
        
        formattedSchedule.push(`## ${gameTypeDesc} Games\n`);
        
        // Add table header
        formattedSchedule.push("| Date | Opponent | Location | Time (ET) | Result |");
        formattedSchedule.push("|------|----------|----------|-----------|--------|");
        
        // Add each game
        filteredGames.forEach((game: any) => {
          // Determine if team is home or away
          const isHome = game.homeTeam && game.homeTeam.abbrev === teamCode;
          const opponent = isHome ? game.awayTeam : game.homeTeam;
          const opponentCode = opponent ? safeString(opponent.abbrev) : "N/A";
          
          // Format date
          const gameDate = game.gameDate ? new Date(game.gameDate).toLocaleDateString() : "N/A";
          
          // Format time
          let gameTime = "N/A";
          if (game.startTimeUTC) {
            try {
              const date = new Date(game.startTimeUTC);
              gameTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
              gameTime = "N/A";
            }
          }
          
          // Format location
          const location = isHome ? "Home" : "Away";
          
          // Format result
          let result = "Upcoming";
          if (game.gameState === "FINAL" || game.gameState === "OFF") {
            const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
            const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;
            result = teamScore > opponentScore ? `W ${teamScore}-${opponentScore}` : `L ${teamScore}-${opponentScore}`;
            
            // Check for OT or SO
            if (game.periodDescriptor && game.periodDescriptor.periodType === "OT") {
              result += " (OT)";
            } else if (game.periodDescriptor && game.periodDescriptor.periodType === "SO") {
              result += " (SO)";
            }
          } else if (game.gameState === "LIVE") {
            const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
            const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;
            result = `${teamScore}-${opponentScore} (Live)`;
          }
          
          formattedSchedule.push(`| ${gameDate} | ${opponentCode} | ${location} | ${gameTime} | ${result} |`);
        });
        
        // Add summary
        formattedSchedule.push(`\nTotal ${gameTypeDesc} Games: ${filteredGames.length}`);
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedSchedule.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-date-schedule",
  "Get the NHL schedule for a specific date",
  {
    date: z.string().describe("Date in YYYY-MM-DD format"),
  },
  async ({ date }: { date: string }) => {
    console.error(`Getting NHL schedule for date: ${date}`);
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid date format. Please provide the date in YYYY-MM-DD format.`,
          },
        ],
      };
    }
    
    // Fetch schedule data from NHL API
    const scheduleUrl = `${NHL_WEB_API_BASE}/schedule/${date}`;
    let scheduleData = null;
    
    try {
      console.error(`Fetching schedule from: ${scheduleUrl}`);
      scheduleData = await makeNHLRequest<any>(scheduleUrl);
      
      if (!scheduleData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve NHL schedule for date: ${date}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching schedule: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving NHL schedule for date: ${date}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the schedule data
    const formattedSchedule = [];
    
    // Add header
    formattedSchedule.push(`# NHL Schedule - ${date}\n`);
    
    // Check if we have game week data
    if (!scheduleData.gameWeek || !Array.isArray(scheduleData.gameWeek) || scheduleData.gameWeek.length === 0) {
      formattedSchedule.push("No games scheduled for this date.");
    } else {
      // Process each day in the game week
      scheduleData.gameWeek.forEach((day: any) => {
        if (day.date === date) {
          formattedSchedule.push(`## ${day.date} (${day.dayAbbrev}) - ${day.numberOfGames} games\n`);
          
          if (!day.games || day.games.length === 0) {
            formattedSchedule.push("No games scheduled for this date.");
            return;
          }
          
          // Add table header
          formattedSchedule.push("| Time (ET) | Away Team | Home Team | Status | Score |");
          formattedSchedule.push("|-----------|-----------|-----------|--------|-------|");
          
          // Add each game
          day.games.forEach((game: any) => {
            // Format time
            let gameTime = "TBD";
            if (game.startTimeUTC) {
              try {
                const date = new Date(game.startTimeUTC);
                gameTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              } catch (e) {
                gameTime = "TBD";
              }
            }
            
            // Get team info
            const awayTeam = game.awayTeam ? safeString(game.awayTeam.abbrev) : "N/A";
            const homeTeam = game.homeTeam ? safeString(game.homeTeam.abbrev) : "N/A";
            
            // Format status
            let status = "Scheduled";
            if (game.gameState === "LIVE") {
              status = "Live";
              if (game.periodDescriptor) {
                status += ` (${game.periodDescriptor.number}${game.periodDescriptor.periodType})`;
              }
            } else if (game.gameState === "FINAL" || game.gameState === "OFF") {
              status = "Final";
              if (game.periodDescriptor && game.periodDescriptor.periodType === "OT") {
                status += " (OT)";
              } else if (game.periodDescriptor && game.periodDescriptor.periodType === "SO") {
                status += " (SO)";
              }
            }
            
            // Format score
            let score = "N/A";
            if (game.gameState === "LIVE" || game.gameState === "FINAL" || game.gameState === "OFF") {
              const awayScore = game.awayTeam ? game.awayTeam.score : 0;
              const homeScore = game.homeTeam ? game.homeTeam.score : 0;
              score = `${awayScore} - ${homeScore}`;
            }
            
            formattedSchedule.push(`| ${gameTime} | ${awayTeam} | ${homeTeam} | ${status} | ${score} |`);
          });
          
          // Add venue information if available
          day.games.forEach((game: any) => {
            if (game.venue) {
              const venue = safeString(game.venue);
              const awayTeam = game.awayTeam ? safeString(game.awayTeam.abbrev) : "N/A";
              const homeTeam = game.homeTeam ? safeString(game.homeTeam.abbrev) : "N/A";
              formattedSchedule.push(`\n${awayTeam} @ ${homeTeam} - Venue: ${venue}`);
            }
          });
        }
      });
      
      // If no matching date was found in the game week
      if (formattedSchedule.length === 1) {
        formattedSchedule.push("No games scheduled for this date.");
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedSchedule.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-date-range-schedule",
  "Get the NHL schedule for a date range",
  {
    startDate: z.string().describe("Start date in YYYY-MM-DD format"),
    endDate: z.string().describe("End date in YYYY-MM-DD format"),
  },
  async ({ startDate, endDate }: { startDate: string; endDate: string }) => {
    console.error(`Getting NHL schedule from ${startDate} to ${endDate}`);
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid date format. Please provide dates in YYYY-MM-DD format.`,
          },
        ],
      };
    }
    
    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid date values. Please provide valid dates.`,
          },
        ],
      };
    }
    
    if (start > end) {
      return {
        content: [
          {
            type: "text",
            text: `Start date must be before or equal to end date.`,
          },
        ],
      };
    }
    
    // Limit range to 14 days to prevent excessive API calls
    const dayDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (dayDiff > 14) {
      return {
        content: [
          {
            type: "text",
            text: `Date range too large. Please limit to 14 days or less.`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the schedule data
    const formattedSchedule = [];
    
    // Add header
    formattedSchedule.push(`# NHL Schedule - ${startDate} to ${endDate}\n`);
    
    // Generate array of dates in the range
    const dates = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Fetch and process schedule for each date
    let totalGames = 0;
    
    for (const date of dates) {
      // Fetch schedule data from NHL API
      const scheduleUrl = `${NHL_WEB_API_BASE}/schedule/${date}`;
      let scheduleData = null;
      
      try {
        console.error(`Fetching schedule for date: ${date}`);
        scheduleData = await makeNHLRequest<any>(scheduleUrl);
        
        if (!scheduleData || !scheduleData.gameWeek) {
          formattedSchedule.push(`## ${date} - Failed to retrieve schedule data`);
          continue;
        }
      } catch (error) {
        console.error(`Error fetching schedule for date ${date}: ${error}`);
        formattedSchedule.push(`## ${date} - Error retrieving schedule data: ${error}`);
        continue;
      }
      
      // Process each day in the game week
      let foundMatchingDay = false;
      
      scheduleData.gameWeek.forEach((day: any) => {
        if (day.date === date) {
          foundMatchingDay = true;
          const numberOfGames = day.numberOfGames || 0;
          totalGames += numberOfGames;
          
          formattedSchedule.push(`## ${day.date} (${day.dayAbbrev}) - ${numberOfGames} games\n`);
          
          if (!day.games || day.games.length === 0) {
            formattedSchedule.push("No games scheduled for this date.\n");
            return;
          }
          
          // Add table header
          formattedSchedule.push("| Time (ET) | Away Team | Home Team | Status | Score |");
          formattedSchedule.push("|-----------|-----------|-----------|--------|-------|");
          
          // Add each game
          day.games.forEach((game: any) => {
            // Format time
            let gameTime = "TBD";
            if (game.startTimeUTC) {
              try {
                const date = new Date(game.startTimeUTC);
                gameTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              } catch (e) {
                gameTime = "TBD";
              }
            }
            
            // Get team info
            const awayTeam = game.awayTeam ? safeString(game.awayTeam.abbrev) : "N/A";
            const homeTeam = game.homeTeam ? safeString(game.homeTeam.abbrev) : "N/A";
            
            // Format status
            let status = "Scheduled";
            if (game.gameState === "LIVE") {
              status = "Live";
              if (game.periodDescriptor) {
                status += ` (${game.periodDescriptor.number}${game.periodDescriptor.periodType})`;
              }
            } else if (game.gameState === "FINAL" || game.gameState === "OFF") {
              status = "Final";
              if (game.periodDescriptor && game.periodDescriptor.periodType === "OT") {
                status += " (OT)";
              } else if (game.periodDescriptor && game.periodDescriptor.periodType === "SO") {
                status += " (SO)";
              }
            }
            
            // Format score
            let score = "N/A";
            if (game.gameState === "LIVE" || game.gameState === "FINAL" || game.gameState === "OFF") {
              const awayScore = game.awayTeam ? game.awayTeam.score : 0;
              const homeScore = game.homeTeam ? game.homeTeam.score : 0;
              score = `${awayScore} - ${homeScore}`;
            }
            
            formattedSchedule.push(`| ${gameTime} | ${awayTeam} | ${homeTeam} | ${status} | ${score} |`);
          });
          
          formattedSchedule.push("");
        }
      });
      
      if (!foundMatchingDay) {
        formattedSchedule.push(`## ${date} - No games scheduled\n`);
      }
    }
    
    // Add summary
    formattedSchedule.push(`\n## Summary`);
    formattedSchedule.push(`Total Games in Range: ${totalGames}`);
    formattedSchedule.push(`Date Range: ${startDate} to ${endDate} (${dayDiff} days)`);
    
    return {
      content: [
        {
          type: "text",
          text: formattedSchedule.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-scores-now",
  "Get current NHL scores",
  {
    includeCompleted: z.boolean().optional().default(true).describe("Include completed games"),
    includeUpcoming: z.boolean().optional().default(true).describe("Include upcoming games"),
  },
  async ({ includeCompleted = true, includeUpcoming = true }: { includeCompleted?: boolean; includeUpcoming?: boolean }) => {
    console.error(`Getting current NHL scores (includeCompleted: ${includeCompleted}, includeUpcoming: ${includeUpcoming})`);
    
    // Fetch schedule data from NHL API
    const scheduleUrl = `${NHL_WEB_API_BASE}/schedule/now`;
    let scheduleData = null;
    
    try {
      console.error(`Fetching scores from: ${scheduleUrl}`);
      scheduleData = await makeNHLRequest<any>(scheduleUrl);
      
      if (!scheduleData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve NHL scores. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching scores: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving NHL scores: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the scores data
    const formattedScores = [];
    
    // Add header
    formattedScores.push(`# NHL Scores - ${new Date().toLocaleDateString()}\n`);
    
    // Check if we have game data
    if (!scheduleData.gameWeek || !Array.isArray(scheduleData.gameWeek) || scheduleData.gameWeek.length === 0) {
      formattedScores.push("No games scheduled for today.");
    } else {
      // Process each day in the game week
      let totalGames = 0;
      let liveGames = 0;
      let completedGames = 0;
      let upcomingGames = 0;
      
      scheduleData.gameWeek.forEach((day: any) => {
        if (!day.games || day.games.length === 0) {
          return;
        }
        
        const currentDate = new Date().toISOString().split('T')[0];
        if (day.date === currentDate) {
          formattedScores.push(`## ${day.date} (${day.dayAbbrev}) - ${day.numberOfGames} games\n`);
          
          // Filter games based on parameters
          let filteredGames = day.games;
          if (!includeCompleted) {
            filteredGames = filteredGames.filter((game: any) => 
              game.gameState !== "FINAL" && game.gameState !== "OFF"
            );
          }
          if (!includeUpcoming) {
            filteredGames = filteredGames.filter((game: any) => 
              game.gameState !== "FUT" && game.gameState !== "PRE"
            );
          }
          
          if (filteredGames.length === 0) {
            formattedScores.push("No games matching the specified filters.");
            return;
          }
          
          // Group games by state
          const liveGamesArray = filteredGames.filter((game: any) => game.gameState === "LIVE");
          const completedGamesArray = filteredGames.filter((game: any) => 
            game.gameState === "FINAL" || game.gameState === "OFF"
          );
          const upcomingGamesArray = filteredGames.filter((game: any) => 
            game.gameState === "FUT" || game.gameState === "PRE"
          );
          
          // Update counters
          liveGames += liveGamesArray.length;
          completedGames += completedGamesArray.length;
          upcomingGames += upcomingGamesArray.length;
          totalGames += filteredGames.length;
          
          // Display live games first
          if (liveGamesArray.length > 0) {
            formattedScores.push("### 🔴 Live Games\n");
            formattedScores.push("| Away | Score | Home | Score | Status | Time |");
            formattedScores.push("|------|-------|------|-------|--------|------|");
            
            liveGamesArray.forEach((game: any) => {
              const awayTeam = game.awayTeam ? safeString(game.awayTeam.abbrev) : "N/A";
              const homeTeam = game.homeTeam ? safeString(game.homeTeam.abbrev) : "N/A";
              const awayScore = game.awayTeam ? game.awayTeam.score : 0;
              const homeScore = game.homeTeam ? game.homeTeam.score : 0;
              
              // Format period info
              let periodInfo = "1st";
              if (game.periodDescriptor) {
                periodInfo = `${game.periodDescriptor.number}${game.periodDescriptor.periodType}`;
              }
              
              // Format clock
              let clockInfo = "N/A";
              if (game.clock && game.clock.timeRemaining) {
                clockInfo = game.clock.timeRemaining;
              }
              
              formattedScores.push(`| ${awayTeam} | ${awayScore} | ${homeTeam} | ${homeScore} | ${periodInfo} | ${clockInfo} |`);
            });
            formattedScores.push("");
          }
          
          // Display completed games
          if (completedGamesArray.length > 0 && includeCompleted) {
            formattedScores.push("### ✅ Final Scores\n");
            formattedScores.push("| Away | Score | Home | Score | Status |");
            formattedScores.push("|------|-------|------|-------|--------|");
            
            completedGamesArray.forEach((game: any) => {
              const awayTeam = game.awayTeam ? safeString(game.awayTeam.abbrev) : "N/A";
              const homeTeam = game.homeTeam ? safeString(game.homeTeam.abbrev) : "N/A";
              const awayScore = game.awayTeam ? game.awayTeam.score : 0;
              const homeScore = game.homeTeam ? game.homeTeam.score : 0;
              
              // Format status
              let status = "Final";
              if (game.periodDescriptor && game.periodDescriptor.periodType === "OT") {
                status = "Final (OT)";
              } else if (game.periodDescriptor && game.periodDescriptor.periodType === "SO") {
                status = "Final (SO)";
              }
              
              formattedScores.push(`| ${awayTeam} | ${awayScore} | ${homeTeam} | ${homeScore} | ${status} |`);
            });
            formattedScores.push("");
          }
          
          // Display upcoming games
          if (upcomingGamesArray.length > 0 && includeUpcoming) {
            formattedScores.push("### 🕒 Upcoming Games\n");
            formattedScores.push("| Away | Home | Time (ET) | Venue |");
            formattedScores.push("|------|------|-----------|-------|");
            
            upcomingGamesArray.forEach((game: any) => {
              const awayTeam = game.awayTeam ? safeString(game.awayTeam.abbrev) : "N/A";
              const homeTeam = game.homeTeam ? safeString(game.homeTeam.abbrev) : "N/A";
              
              // Format time
              let gameTime = "TBD";
              if (game.startTimeUTC) {
                try {
                  const date = new Date(game.startTimeUTC);
                  gameTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch (e) {
                  gameTime = "TBD";
                }
              }
              
              // Format venue
              const venue = game.venue ? safeString(game.venue) : "N/A";
              
              formattedScores.push(`| ${awayTeam} | ${homeTeam} | ${gameTime} | ${venue} |`);
            });
            formattedScores.push("");
          }
        }
      });
      
      // Add summary
      formattedScores.push("## Summary");
      formattedScores.push(`Total Games Today: ${totalGames}`);
      if (liveGames > 0) formattedScores.push(`🔴 Live Games: ${liveGames}`);
      if (completedGames > 0 && includeCompleted) formattedScores.push(`✅ Completed Games: ${completedGames}`);
      if (upcomingGames > 0 && includeUpcoming) formattedScores.push(`🕒 Upcoming Games: ${upcomingGames}`);
      
      // If no matching date was found in the game week
      if (totalGames === 0) {
        formattedScores.push("No games scheduled for today.");
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedScores.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-scores-by-date",
  "Get NHL scores for a specific date",
  {
    date: z.string().describe("Date in YYYY-MM-DD format"),
    includeCompleted: z.boolean().optional().default(true).describe("Include completed games"),
    includeUpcoming: z.boolean().optional().default(true).describe("Include upcoming games"),
  },
  async ({ date, includeCompleted = true, includeUpcoming = true }: { date: string; includeCompleted?: boolean; includeUpcoming?: boolean }) => {
    console.error(`Getting NHL scores for date: ${date} (includeCompleted: ${includeCompleted}, includeUpcoming: ${includeUpcoming})`);
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid date format. Please provide the date in YYYY-MM-DD format.`,
          },
        ],
      };
    }
    
    // Fetch schedule data from NHL API
    const scheduleUrl = `${NHL_WEB_API_BASE}/schedule/${date}`;
    let scheduleData = null;
    
    try {
      console.error(`Fetching scores from: ${scheduleUrl}`);
      scheduleData = await makeNHLRequest<any>(scheduleUrl);
      
      if (!scheduleData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve NHL scores for date: ${date}. The NHL API might be unavailable.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching scores: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving NHL scores for date: ${date}: ${error}`,
          },
        ],
      };
    }
    
    // Safe string extraction function
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (typeof value === 'object' && value.default) return value.default;
      return defaultValue;
    };
    
    // Format the scores data
    const formattedScores = [];
    
    // Add header
    formattedScores.push(`# NHL Scores - ${date}\n`);
    
    // Check if we have game week data
    if (!scheduleData.gameWeek || !Array.isArray(scheduleData.gameWeek) || scheduleData.gameWeek.length === 0) {
      formattedScores.push("No games scheduled for this date.");
    } else {
      // Process each day in the game week
      let totalGames = 0;
      let liveGames = 0;
      let completedGames = 0;
      let upcomingGames = 0;
      let foundMatchingDay = false;
      
      scheduleData.gameWeek.forEach((day: any) => {
        if (day.date === date) {
          foundMatchingDay = true;
          formattedScores.push(`## ${day.date} (${day.dayAbbrev}) - ${day.numberOfGames} games\n`);
          
          if (!day.games || day.games.length === 0) {
            formattedScores.push("No games scheduled for this date.");
            return;
          }
          
          // Filter games based on parameters
          let filteredGames = day.games;
          if (!includeCompleted) {
            filteredGames = filteredGames.filter((game: any) => 
              game.gameState !== "FINAL" && game.gameState !== "OFF"
            );
          }
          if (!includeUpcoming) {
            filteredGames = filteredGames.filter((game: any) => 
              game.gameState !== "FUT" && game.gameState !== "PRE"
            );
          }
          
          if (filteredGames.length === 0) {
            formattedScores.push("No games matching the specified filters.");
            return;
          }
          
          // Group games by state
          const liveGamesArray = filteredGames.filter((game: any) => game.gameState === "LIVE");
          const completedGamesArray = filteredGames.filter((game: any) => 
            game.gameState === "FINAL" || game.gameState === "OFF"
          );
          const upcomingGamesArray = filteredGames.filter((game: any) => 
            game.gameState === "FUT" || game.gameState === "PRE"
          );
          
          // Update counters
          liveGames += liveGamesArray.length;
          completedGames += completedGamesArray.length;
          upcomingGames += upcomingGamesArray.length;
          totalGames += filteredGames.length;
          
          // Display live games first
          if (liveGamesArray.length > 0) {
            formattedScores.push("### 🔴 Live Games\n");
            formattedScores.push("| Away | Score | Home | Score | Status | Time |");
            formattedScores.push("|------|-------|------|-------|--------|------|");
            
            liveGamesArray.forEach((game: any) => {
              const awayTeam = game.awayTeam ? safeString(game.awayTeam.abbrev) : "N/A";
              const homeTeam = game.homeTeam ? safeString(game.homeTeam.abbrev) : "N/A";
              const awayScore = game.awayTeam ? game.awayTeam.score : 0;
              const homeScore = game.homeTeam ? game.homeTeam.score : 0;
              
              // Format period info
              let periodInfo = "1st";
              if (game.periodDescriptor) {
                periodInfo = `${game.periodDescriptor.number}${game.periodDescriptor.periodType}`;
              }
              
              // Format clock
              let clockInfo = "N/A";
              if (game.clock && game.clock.timeRemaining) {
                clockInfo = game.clock.timeRemaining;
              }
              
              formattedScores.push(`| ${awayTeam} | ${awayScore} | ${homeTeam} | ${homeScore} | ${periodInfo} | ${clockInfo} |`);
            });
            formattedScores.push("");
          }
          
          // Display completed games
          if (completedGamesArray.length > 0 && includeCompleted) {
            formattedScores.push("### ✅ Final Scores\n");
            formattedScores.push("| Away | Score | Home | Score | Status |");
            formattedScores.push("|------|-------|------|-------|--------|");
            
            completedGamesArray.forEach((game: any) => {
              const awayTeam = game.awayTeam ? safeString(game.awayTeam.abbrev) : "N/A";
              const homeTeam = game.homeTeam ? safeString(game.homeTeam.abbrev) : "N/A";
              const awayScore = game.awayTeam ? game.awayTeam.score : 0;
              const homeScore = game.homeTeam ? game.homeTeam.score : 0;
              
              // Format status
              let status = "Final";
              if (game.periodDescriptor && game.periodDescriptor.periodType === "OT") {
                status = "Final (OT)";
              } else if (game.periodDescriptor && game.periodDescriptor.periodType === "SO") {
                status = "Final (SO)";
              }
              
              formattedScores.push(`| ${awayTeam} | ${awayScore} | ${homeTeam} | ${homeScore} | ${status} |`);
            });
            formattedScores.push("");
          }
          
          // Display upcoming games
          if (upcomingGamesArray.length > 0 && includeUpcoming) {
            formattedScores.push("### 🕒 Upcoming Games\n");
            formattedScores.push("| Away | Home | Time (ET) | Venue |");
            formattedScores.push("|------|------|-----------|-------|");
            
            upcomingGamesArray.forEach((game: any) => {
              const awayTeam = game.awayTeam ? safeString(game.awayTeam.abbrev) : "N/A";
              const homeTeam = game.homeTeam ? safeString(game.homeTeam.abbrev) : "N/A";
              
              // Format time
              let gameTime = "TBD";
              if (game.startTimeUTC) {
                try {
                  const date = new Date(game.startTimeUTC);
                  gameTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } catch (e) {
                  gameTime = "TBD";
                }
              }
              
              // Format venue
              const venue = game.venue ? safeString(game.venue) : "N/A";
              
              formattedScores.push(`| ${awayTeam} | ${homeTeam} | ${gameTime} | ${venue} |`);
            });
            formattedScores.push("");
          }
          
          // Add team leaders if available
          const gamesWithLeaders = filteredGames.filter((game: any) => game.teamLeaders && game.teamLeaders.length > 0);
          if (gamesWithLeaders.length > 0) {
            formattedScores.push("### 🏆 Team Leaders\n");
            
            gamesWithLeaders.forEach((game: any) => {
              const awayTeam = game.awayTeam ? safeString(game.awayTeam.abbrev) : "N/A";
              const homeTeam = game.homeTeam ? safeString(game.homeTeam.abbrev) : "N/A";
              
              formattedScores.push(`#### ${awayTeam} @ ${homeTeam}\n`);
              
              if (game.teamLeaders && game.teamLeaders.length > 0) {
                formattedScores.push("| Team | Player | Position | Category | Value |");
                formattedScores.push("|------|--------|----------|----------|-------|");
                
                game.teamLeaders.forEach((leader: any) => {
                  const team = leader.teamAbbrev || "N/A";
                  const playerName = `${safeString(leader.firstName)} ${safeString(leader.lastName)}`;
                  const position = leader.position || "N/A";
                  const category = leader.category || "N/A";
                  const value = leader.value || 0;
                  
                  formattedScores.push(`| ${team} | ${playerName} | ${position} | ${category} | ${value} |`);
                });
                formattedScores.push("");
              }
            });
          }
        }
      });
      
      // Add summary
      if (foundMatchingDay) {
        formattedScores.push("## Summary");
        formattedScores.push(`Total Games: ${totalGames}`);
        if (liveGames > 0) formattedScores.push(`🔴 Live Games: ${liveGames}`);
        if (completedGames > 0 && includeCompleted) formattedScores.push(`✅ Completed Games: ${completedGames}`);
        if (upcomingGames > 0 && includeUpcoming) formattedScores.push(`🕒 Upcoming Games: ${upcomingGames}`);
      } else {
        formattedScores.push("No games scheduled for this date.");
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedScores.join("\n"),
        },
      ],
    };
  }
);

server.tool(
  "get-game-play-by-play",
  "Get play-by-play data for a specific NHL game",
  {
    gameId: z.string().describe("Game ID in the format YYYYYYYY (e.g., 2023020204)"),
    maxEvents: z.number().optional().default(50).describe("Maximum number of events to return (default: 50, use 0 for all)"),
    filterByType: z.string().optional().describe("Filter events by type (e.g., 'goal', 'penalty', 'shot-on-goal', 'hit')"),
  },
  async ({ gameId, maxEvents = 50, filterByType }: { gameId: string; maxEvents?: number; filterByType?: string }) => {
    console.error(`Getting play-by-play data for game ${gameId} (maxEvents: ${maxEvents}, filterByType: ${filterByType || 'none'})`);
    
    // Fetch play-by-play data from NHL API
    const playByPlayUrl = `${NHL_WEB_API_BASE}/gamecenter/${gameId}/play-by-play`;
    let playByPlayData = null;
    
    try {
      console.error(`Fetching play-by-play data from: ${playByPlayUrl}`);
      playByPlayData = await makeNHLRequest<any>(playByPlayUrl);
      
      if (!playByPlayData) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve play-by-play data. The NHL API might be unavailable or the game ID might be invalid.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error fetching play-by-play data: ${error}`);
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving play-by-play data: ${error}`,
          },
        ],
      };
    }

    // Helper function for safe string extraction
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) {
        return defaultValue;
      }
      if (typeof value === "object" && value.default) {
        return value.default;
      }
      return String(value);
    };

    // Create a map of player IDs to names
    const playerMap = new Map<number, string>();
    if (playByPlayData.rosterSpots && Array.isArray(playByPlayData.rosterSpots)) {
      playByPlayData.rosterSpots.forEach((player: any) => {
        if (player.playerId && player.firstName && player.lastName) {
          const firstName = safeString(player.firstName);
          const lastName = safeString(player.lastName);
          playerMap.set(player.playerId, `${firstName} ${lastName}`);
        }
      });
    }

    // Helper function to get player name from ID
    const getPlayerName = (playerId: number): string => {
      return playerMap.get(playerId) || `Player #${playerId}`;
    };

    // Format the play-by-play data
    const formattedPlayByPlay: string[] = [];
    
    // Add game information header
    const homeTeam = playByPlayData.homeTeam ? `${safeString(playByPlayData.homeTeam.placeName)} ${safeString(playByPlayData.homeTeam.commonName)}` : "Home Team";
    const awayTeam = playByPlayData.awayTeam ? `${safeString(playByPlayData.awayTeam.placeName)} ${safeString(playByPlayData.awayTeam.commonName)}` : "Away Team";
    const homeScore = playByPlayData.homeTeam?.score || 0;
    const awayScore = playByPlayData.awayTeam?.score || 0;
    const venue = safeString(playByPlayData.venue);
    const gameDate = safeString(playByPlayData.gameDate);
    
    formattedPlayByPlay.push(`# Play-by-Play: ${awayTeam} (${awayScore}) @ ${homeTeam} (${homeScore})`);
    formattedPlayByPlay.push(`**Game ID:** ${gameId} | **Date:** ${gameDate} | **Venue:** ${venue}`);
    formattedPlayByPlay.push("");
    
    // Process plays
    if (playByPlayData.plays && Array.isArray(playByPlayData.plays)) {
      let plays = playByPlayData.plays;
      
      // Filter by type if specified
      if (filterByType) {
        const filterLower = filterByType.toLowerCase();
        plays = plays.filter((play: any) => {
          const typeDescKey = play.typeDescKey?.toLowerCase() || '';
          return typeDescKey.includes(filterLower);
        });
      }
      
      // Limit the number of events if specified
      if (maxEvents > 0 && plays.length > maxEvents) {
        formattedPlayByPlay.push(`*Showing ${maxEvents} of ${plays.length} total events. Use maxEvents=0 to see all events.*`);
        plays = plays.slice(0, maxEvents);
      }
      
      // Add table header
      formattedPlayByPlay.push("| Period | Time | Event | Details |");
      formattedPlayByPlay.push("|--------|------|-------|---------|");
      
      // Add plays to table
      plays.forEach((play: any) => {
        const period = play.periodDescriptor ? `${play.periodDescriptor.number} ${play.periodDescriptor.periodType}` : "N/A";
        const timeInPeriod = play.timeInPeriod || "00:00";
        const eventType = safeString(play.typeDescKey).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        let details = "";
        if (play.details) {
          if (play.typeDescKey === "goal") {
            const scorer = play.details.scoringPlayerId 
              ? `**Goal:** ${getPlayerName(play.details.scoringPlayerId)}` 
              : "**Goal**";
            
            let assists = "";
            if (play.details.assist1PlayerId) {
              assists += `, Assist: ${getPlayerName(play.details.assist1PlayerId)}`;
              if (play.details.assist2PlayerId) {
                assists += `, ${getPlayerName(play.details.assist2PlayerId)}`;
              }
            }
            
            const shotType = play.details.shotType ? ` (${play.details.shotType})` : "";
            details = `${scorer}${assists}${shotType}`;
            
            // Add score
            if (play.details.awayScore !== undefined && play.details.homeScore !== undefined) {
              details += ` | Score: ${awayTeam} ${play.details.awayScore}, ${homeTeam} ${play.details.homeScore}`;
            }
            
            // Add highlight clip if available
            if (play.details.highlightClipSharingUrl) {
              details += ` | [Watch](${play.details.highlightClipSharingUrl})`;
            }
          } else if (play.typeDescKey === "penalty") {
            const penaltyType = safeString(play.details.descKey).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const player = play.details.committedByPlayerId 
              ? getPlayerName(play.details.committedByPlayerId) 
              : "Unknown player";
            const duration = play.details.duration || 2;
            
            details = `**${penaltyType}** by ${player} (${duration} min)`;
            
            if (play.details.drawnByPlayerId) {
              details += ` | Drawn by: ${getPlayerName(play.details.drawnByPlayerId)}`;
            }
          } else if (play.typeDescKey === "shot-on-goal") {
            const player = play.details.shootingPlayerId 
              ? getPlayerName(play.details.shootingPlayerId) 
              : "Unknown player";
            const shotType = play.details.shotType ? ` (${play.details.shotType})` : "";
            
            details = `Shot by ${player}${shotType}`;
            
            if (play.details.goalieInNetId) {
              details += ` | Saved by: ${getPlayerName(play.details.goalieInNetId)}`;
            }
          } else if (play.typeDescKey === "missed-shot") {
            const player = play.details.shootingPlayerId 
              ? getPlayerName(play.details.shootingPlayerId) 
              : "Unknown player";
            const shotType = play.details.shotType ? ` (${play.details.shotType})` : "";
            const reason = play.details.reason ? ` - ${play.details.reason.replace(/-/g, ' ')}` : "";
            
            details = `Missed shot by ${player}${shotType}${reason}`;
          } else if (play.typeDescKey === "blocked-shot") {
            const shooter = play.details.shootingPlayerId 
              ? getPlayerName(play.details.shootingPlayerId) 
              : "Unknown player";
            const blocker = play.details.blockingPlayerId 
              ? getPlayerName(play.details.blockingPlayerId) 
              : "Unknown player";
            
            details = `Shot by ${shooter} blocked by ${blocker}`;
          } else if (play.typeDescKey === "hit") {
            const hitter = play.details.hittingPlayerId 
              ? getPlayerName(play.details.hittingPlayerId) 
              : "Unknown player";
            const hittee = play.details.hitteePlayerId 
              ? getPlayerName(play.details.hitteePlayerId) 
              : "Unknown player";
            
            details = `${hitter} hit ${hittee}`;
          } else if (play.typeDescKey === "faceoff") {
            const winner = play.details.winningPlayerId 
              ? getPlayerName(play.details.winningPlayerId) 
              : "Unknown player";
            const loser = play.details.losingPlayerId 
              ? getPlayerName(play.details.losingPlayerId) 
              : "Unknown player";
            
            details = `${winner} won faceoff against ${loser}`;
          } else if (play.typeDescKey === "takeaway") {
            const player = play.details.playerId 
              ? getPlayerName(play.details.playerId) 
              : "Unknown player";
            
            details = `Takeaway by ${player}`;
          } else if (play.typeDescKey === "giveaway") {
            const player = play.details.playerId 
              ? getPlayerName(play.details.playerId) 
              : "Unknown player";
            
            details = `Giveaway by ${player}`;
          } else if (play.typeDescKey === "period-start") {
            details = `Period ${period} started`;
          } else if (play.typeDescKey === "period-end") {
            details = `Period ${period} ended`;
          } else if (play.typeDescKey === "game-end") {
            details = `Game ended`;
          } else if (play.typeDescKey === "stoppage") {
            details = `Stoppage: ${safeString(play.details.reason).replace(/-/g, ' ')}`;
          } else {
            // Generic details for other event types
            details = Object.entries(play.details)
              .filter(([key]) => !["eventOwnerTeamId", "zoneCode", "xCoord", "yCoord"].includes(key))
              .map(([key, value]) => {
                if (key.includes("PlayerId") && typeof value === "number") {
                  return `${key}: ${getPlayerName(value as number)}`;
                }
                return `${key}: ${value}`;
              })
              .join(", ");
          }
        }
        
        formattedPlayByPlay.push(`| ${period} | ${timeInPeriod} | ${eventType} | ${details} |`);
      });
    } else {
      formattedPlayByPlay.push("No play-by-play data available for this game.");
    }
    
    // Add summary
    formattedPlayByPlay.push("");
    formattedPlayByPlay.push("## Game Summary");
    formattedPlayByPlay.push(`**Final Score:** ${awayTeam} ${awayScore}, ${homeTeam} ${homeScore}`);
    
    if (playByPlayData.gameState) {
      formattedPlayByPlay.push(`**Game State:** ${playByPlayData.gameState}`);
    }
    
    // Add period summary
    if (playByPlayData.summary) {
      formattedPlayByPlay.push("");
      formattedPlayByPlay.push("## Period Summary");
      formattedPlayByPlay.push("| Period | Away Shots | Home Shots | Away Goals | Home Goals |");
      formattedPlayByPlay.push("|--------|------------|------------|-----------|-----------|");
      
      // Add period stats if available
      if (playByPlayData.summary.byPeriod && Array.isArray(playByPlayData.summary.byPeriod)) {
        playByPlayData.summary.byPeriod.forEach((period: any) => {
          const periodNum = period.periodDescriptor ? `${period.periodDescriptor.number} ${period.periodDescriptor.periodType}` : "N/A";
          const awaySog = period.away?.shotsOnGoal || 0;
          const homeSog = period.home?.shotsOnGoal || 0;
          const awayGoals = period.away?.goals || 0;
          const homeGoals = period.home?.goals || 0;
          
          formattedPlayByPlay.push(`| ${periodNum} | ${awaySog} | ${homeSog} | ${awayGoals} | ${homeGoals} |`);
        });
      }
      
      // Add totals
      if (playByPlayData.summary.totals) {
        const awaySog = playByPlayData.summary.totals.away?.shotsOnGoal || 0;
        const homeSog = playByPlayData.summary.totals.home?.shotsOnGoal || 0;
        const awayGoals = playByPlayData.summary.totals.away?.goals || 0;
        const homeGoals = playByPlayData.summary.totals.home?.goals || 0;
        
        formattedPlayByPlay.push(`| **Total** | **${awaySog}** | **${homeSog}** | **${awayGoals}** | **${homeGoals}** |`);
      }
    }
    
    return {
      content: [
        {
          type: "text",
          text: formattedPlayByPlay.join("\n"),
        },
      ],
    };
  }
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