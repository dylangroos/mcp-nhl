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
    const teamCode = teamAbbrev.toUpperCase().trim();
    console.error(`Getting information for team: ${teamCode}`);
    
    // List of endpoints to try in order
    const endpoints = [
      {
        name: "Roster API",
        url: `${NHL_WEB_API_BASE}/roster/${teamCode}/current`,
        parseTeam: (data: any): TeamResponse => {
          console.error("Roster API data keys:", Object.keys(data));
          return {
            teamId: data.teamId,
            name: data.name || data.fullName,
            abbrev: teamCode,
            locationName: data.locationName,
            teamName: data.teamName,
            division: data.division,
            conference: data.conference
          };
        }
      },
      {
        name: "Club Stats API",
        url: `${NHL_WEB_API_BASE}/club-stats/${teamCode}/now`,
        parseTeam: (data: any): TeamResponse => {
          console.error("Club Stats API data keys:", Object.keys(data));
          const teamInfo = {
            teamId: data.teamId || data.id,
            name: data.teamName || data.name,
            abbrev: teamCode,
            locationName: data.locationName,
            teamName: data.teamName || data.name,
            record: data.teamStats && data.teamStats[0] ? {
              wins: data.teamStats[0].wins || 0,
              losses: data.teamStats[0].losses || 0,
              otLosses: data.teamStats[0].otLosses || 0,
              points: data.teamStats[0].points || 0
            } : undefined
          };
          return teamInfo;
        }
      },
      {
        name: "Team Info API",
        url: `${NHL_STATS_API_BASE}/team`,
        parseTeam: (data: any): TeamResponse => {
          console.error("Team Info API data keys:", Object.keys(data));
          const teams = data.data || [];
          const matchingTeam = teams.find((t: any) => 
            t.triCode === teamCode || 
            t.abbrev === teamCode || 
            t.teamAbbrev?.default === teamCode
          );
          
          if (!matchingTeam) {
            console.error("No matching team found in team info data");
            return {};
          }
          
          return {
            teamId: matchingTeam.id || matchingTeam.teamId,
            name: matchingTeam.name || matchingTeam.fullName,
            abbrev: teamCode,
            locationName: matchingTeam.locationName,
            teamName: matchingTeam.teamName,
            division: { 
              name: matchingTeam.divisionName || (matchingTeam.division && matchingTeam.division.name),
              shortName: matchingTeam.divisionAbbrev || (matchingTeam.division && matchingTeam.division.nameShort) 
            },
            conference: { 
              name: matchingTeam.conferenceName || (matchingTeam.conference && matchingTeam.conference.name),
              shortName: matchingTeam.conferenceAbbrev || (matchingTeam.conference && matchingTeam.conference.nameShort) 
            }
          };
        }
      },
      {
        name: "Standings API",
        url: `${NHL_WEB_API_BASE}/standings/now`,
        parseTeam: (data: any): TeamResponse => {
          console.error("Standings API data keys:", Object.keys(data));
          let division;
          let foundTeam;
          
          // Navigate through possible data structures
          const divisions = data.standings?.divisionStandings || 
                            data.divisionStandings || 
                            data.records || 
                            [];
          
          for (const div of divisions) {
            const teams = div.teamRecords || div.teams || [];
            const team = teams.find((t: any) => 
              t.teamAbbrev?.default === teamCode || 
              t.abbrev === teamCode || 
              t.triCode === teamCode
            );
            
            if (team) {
              division = div;
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
            division: { 
              name: division.divisionName || "Unknown Division", 
              shortName: division.divisionAbbrev || "" 
            },
            conference: { 
              name: division.conferenceAbbrev === "E" ? "Eastern" : 
                   division.conferenceAbbrev === "W" ? "Western" : 
                   division.conferenceName || "Unknown", 
              shortName: division.conferenceAbbrev || "" 
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
    console.error(`Getting information for player ID: ${playerId}`);
    
    // List of endpoints to try in order
    const endpoints = [
      {
        name: "Player Landing API",
        url: `${NHL_WEB_API_BASE}/player/${playerId}/landing`,
        parsePlayer: (data: any): PlayerResponse => data
      },
      {
        name: "Stats API Player Info",
        url: `${NHL_STATS_API_BASE}/player/${playerId}`,
        parsePlayer: (data: any): PlayerResponse => {
          if (!data || !data.data || data.data.length === 0) {
            return {};
          }
          const player = data.data[0];
          return {
            playerId: player.playerId || player.id,
            firstName: player.firstName,
            lastName: player.lastName,
            fullName: player.firstName + ' ' + player.lastName,
            position: player.positionCode,
            sweaterNumber: player.sweaterNumber,
            birthDate: player.birthDate,
            birthCity: player.birthCity,
            birthCountry: player.birthCountry,
            height: player.height,
            weight: player.weight,
            teamId: player.teamId,
            shootsCatches: player.shootsCatches,
            rookie: player.rookie
          };
        }
      }
    ];
    
    // Try each endpoint until we get valid player data
    let playerData: PlayerResponse | null = null;
    let errorMessages = [];
    
    for (const endpoint of endpoints) {
      try {
        console.error(`Trying ${endpoint.name} endpoint: ${endpoint.url}`);
        const data = await makeNHLRequest<any>(endpoint.url);
        
        if (data) {
          console.error(`Got response from ${endpoint.name}`);
          const parsedPlayer = endpoint.parsePlayer(data);
          
          if (parsedPlayer && (parsedPlayer.fullName || (parsedPlayer.firstName && parsedPlayer.lastName))) {
            playerData = parsedPlayer;
            console.error(`Got player data from ${endpoint.name}`);
            break;
          }
        }
      } catch (error) {
        const message = `Error with ${endpoint.name}: ${error}`;
        console.error(message);
        errorMessages.push(message);
      }
    }

    if (!playerData) {
      console.error(`Failed to retrieve data for player ID: ${playerId}. Errors: ${errorMessages.join("; ")}`);
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve data for player ID: ${playerId}. The player ID may be invalid or NHL API might be unavailable.`,
          },
        ],
      };
    }

    // Get player stats
    const statsUrl = `${NHL_WEB_API_BASE}/player/${playerId}/game-log/now`;
    let statsData = null;
    
    try {
      statsData = await makeNHLRequest<any>(statsUrl);
      console.error("Retrieved player stats data");
    } catch (error) {
      console.error("Error retrieving player stats:", error);
    }
    
    // Get their team information
    let teamName = "Unknown Team";
    let teamAbbrev = "";
    
    if (playerData.teamId) {
      try {
        // Try to get team abbreviation first
        const teamUrls = [
          `${NHL_WEB_API_BASE}/standings/now`,
          `${NHL_STATS_API_BASE}/team`
        ];
        
        for (const url of teamUrls) {
          console.error(`Looking up team ID ${playerData.teamId} in ${url}`);
          const teamsData = await makeNHLRequest<any>(url);
          
          if (!teamsData) continue;
          
          // Check different data structures
          if (teamsData.standings?.divisionStandings) {
            for (const division of teamsData.standings.divisionStandings) {
              for (const team of (division.teamRecords || [])) {
                if (team.teamId === playerData.teamId) {
                  teamName = team.teamName?.default || "Unknown Team";
                  teamAbbrev = team.teamAbbrev?.default || "";
                  break;
                }
              }
            }
          } else if (teamsData.data) {
            // Stats API format
            const team = teamsData.data.find((t: any) => t.id === playerData.teamId);
            if (team) {
              teamName = team.name || team.fullName || "Unknown Team";
              teamAbbrev = team.triCode || team.abbrev || "";
            }
          }
          
          if (teamName !== "Unknown Team") break;
        }
        
        // If we have the abbreviation but not the full name, get it
        if (teamAbbrev && teamName === "Unknown Team") {
          const teamData = await makeNHLRequest<any>(`${NHL_WEB_API_BASE}/roster/${teamAbbrev}/current`);
          if (teamData) {
            teamName = teamData.name || 
                      (teamData.locationName && teamData.teamName) ? 
                      `${teamData.locationName} ${teamData.teamName}` : 
                      teamAbbrev;
          }
        }
      } catch (error) {
        console.error("Error retrieving team information:", error);
      }
    }
    
    // Safe string extraction functions to prevent [object Object] issues
    const safeString = (value: any, defaultValue: string = "N/A"): string => {
      if (value === null || value === undefined) return defaultValue;
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return defaultValue; // Return default for objects/arrays
    };
    
    // Format the player's name properly
    let playerName: string;
    if (typeof playerData.fullName === 'string') {
      playerName = playerData.fullName;
    } else if (typeof playerData.firstName === 'string' && typeof playerData.lastName === 'string') {
      playerName = `${playerData.firstName} ${playerData.lastName}`;
    } else {
      playerName = `Player #${playerId}`;
    }
    
    // Format the birth place properly
    const birthCity = safeString(playerData.birthCity, "Unknown City");
    const birthCountry = safeString(playerData.birthCountry, "Unknown Country");
    const birthPlace = `${birthCity}${birthCountry !== "Unknown Country" ? ', ' + birthCountry : ''}`;

    const playerInfo = [
      `Name: ${playerName}`,
      `Position: ${safeString(playerData.position, "Unknown")}`,
      `Jersey Number: ${safeString(playerData.sweaterNumber, "N/A")}`,
      `Team: ${teamName}`,
      `Birth Date: ${safeString(playerData.birthDate, "Unknown")}`,
      `Birth Place: ${birthPlace}`,
      `Height: ${safeString(playerData.height, "N/A")}`,
      `Weight: ${playerData.weight ? `${safeString(playerData.weight)} lbs` : "N/A"}`,
      `Shoots/Catches: ${safeString(playerData.shootsCatches, "N/A")}`,
      `Rookie: ${playerData.rookie === true ? "Yes" : "No"}`,
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
          `  Shooting Percentage: ${stats.shootingPctg ? `${stats.shootingPctg}%` : "0%"}`
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
    // Try multiple possible endpoints for standings
    const standingsUrls = [
      `${NHL_WEB_API_BASE}/standings/now`,
      `${NHL_WEB_API_BASE}/standings`,
      `${NHL_STATS_API_BASE}/standings/now`
    ];
    
    let standingsData = null;
    
    // Try each URL until we get data
    for (const url of standingsUrls) {
      console.error(`Trying to fetch standings from: ${url}`);
      const data = await makeNHLRequest<any>(url);
      if (data) {
        standingsData = data;
        console.error("Successfully retrieved standings data");
        break;
      }
    }

    if (!standingsData) {
      return {
        content: [
          {
            type: "text",
            text: "Failed to retrieve NHL standings - NHL API endpoints might be down",
          },
        ],
      };
    }
    
    // Debugging output
    console.error("Standings Data Keys:", Object.keys(standingsData));
    
    // Access the correct structure for standings data with multiple possible paths
    let divisions = [];
    
    // Check all possible paths for divisions data
    if (standingsData.standings?.divisionStandings) {
      divisions = standingsData.standings.divisionStandings;
      console.error("Found divisions at: standings.divisionStandings");
    } else if (standingsData.divisionStandings) {
      divisions = standingsData.divisionStandings;
      console.error("Found divisions at: divisionStandings");
    } else if (Array.isArray(standingsData) && standingsData.length > 0) {
      // Maybe it's directly an array of divisions
      divisions = standingsData;
      console.error("Standings data is directly an array");
    } else if (standingsData.records) {
      // Another possible format
      divisions = standingsData.records;
      console.error("Found divisions at: records");
    }
    
    // Still no divisions, try to look deeper for any array that might contain division info
    if (divisions.length === 0) {
      for (const key in standingsData) {
        if (Array.isArray(standingsData[key]) && standingsData[key].length > 0) {
          // Check if this array has divisionName properties
          if (standingsData[key][0].divisionName || 
              standingsData[key][0].teams || 
              standingsData[key][0].teamRecords) {
            divisions = standingsData[key];
            console.error(`Found potential divisions at: ${key}`);
            break;
          }
        }
      }
    }
    
    // If still empty, return a descriptive error
    if (divisions.length === 0) {
      console.error("No divisions found in data structure:", JSON.stringify(standingsData).substring(0, 500) + "...");
      return {
        content: [
          {
            type: "text",
            text: "Could not find standings data in the NHL API response. The API structure may have changed.",
          },
        ],
      };
    }
    
    // Filter by division if provided
    if (division) {
      const filteredDivisions = divisions.filter(
        (div: any) => {
          const divName = div.divisionName || '';
          return divName.toLowerCase() === division.toLowerCase();
        }
      );
      
      if (filteredDivisions.length === 0) {
        // Try partial match if exact match fails
        const possibleDivisions = divisions.filter(
          (div: any) => {
            const divName = div.divisionName || '';
            return divName.toLowerCase().includes(division.toLowerCase());
          }
        );
        
        if (possibleDivisions.length > 0) {
          divisions = possibleDivisions;
        } else {
          return {
            content: [
              {
                type: "text",
                text: `No standings found for division: ${division}. Available divisions: ${divisions.map((d: any) => d.divisionName).join(', ')}`,
              },
            ],
          };
        }
      } else {
        divisions = filteredDivisions;
      }
    }

    // Format standings by division
    const formattedStandings = divisions.map((div: any) => {
      const teams = div.teamRecords || [];
      
      if (teams.length === 0) {
        return `${div.divisionName || 'Unknown'} Division: No team data available`;
      }
      
      const teamRows = teams.map((team: any) => {
        const abbrev = team.teamAbbrev?.default || 'N/A';
        const gp = team.gamesPlayed?.toString() || '0';
        const wins = team.wins?.toString() || '0';
        const losses = team.losses?.toString() || '0';
        const otLosses = team.otLosses?.toString() || '0';
        const points = team.points?.toString() || '0';
        const goalsFor = team.goalsFor?.toString() || '0';
        const goalsAgainst = team.goalsAgainst?.toString() || '0';
        const streak = `${team.streakCode || ''}${team.streakCount || ''}`;
        
        return [
          `${abbrev.padEnd(5)} | `,
          `${gp.padStart(2)} | `,
          `${wins.padStart(2)}-`,
          `${losses.padStart(2)}-`,
          `${otLosses.padStart(2)} | `,
          `${points.padStart(3)} pts | `,
          `${goalsFor.padStart(3)} GF | `,
          `${goalsAgainst.padStart(3)} GA | `,
          `${streak}`,
        ].join("");
      });

      const conferenceName = div.conferenceAbbrev === 'E' ? 'Eastern' : 
                           div.conferenceAbbrev === 'W' ? 'Western' : 
                           div.conferenceAbbrev || 'Unknown';
                           
      return [
        `${div.divisionName || 'Unknown'} Division (${conferenceName} Conference):`,
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