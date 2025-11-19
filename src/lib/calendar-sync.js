// Google Calendar Integration for Spatial View
// Allows AI assistants to read upcoming events for better planning

const CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

/**
 * Initialize Google Calendar API
 */
let tokenClient = null;
let accessToken = null;

function initGoogleCalendar() {
  return new Promise((resolve, reject) => {
    if (typeof google === 'undefined' || !google.accounts) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }

    const clientId = localStorage.getItem('googleDriveClientId');
    if (!clientId) {
      reject(new Error('No Google Client ID found. Set up Drive sync first.'));
      return;
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CALENDAR_SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        accessToken = response.access_token;
        resolve(accessToken);
      },
    });

    resolve(tokenClient);
  });
}

/**
 * Request access token for Calendar API
 */
async function getCalendarAccessToken() {
  if (accessToken) {
    return accessToken;
  }

  await initGoogleCalendar();

  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Token client not initialized'));
      return;
    }

    // Request token
    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }
      accessToken = response.access_token;
      resolve(accessToken);
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Fetch calendar events for the next N weeks
 * @param {number} weeks - Number of weeks to fetch (default: 3)
 * @returns {Promise<Array>} - Array of calendar events
 */
export async function getUpcomingCalendarEvents(weeks = 3) {
  try {
    const token = await getCalendarAccessToken();

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + (weeks * 7));

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.append('timeMin', now.toISOString());
    url.searchParams.append('timeMax', futureDate.toISOString());
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');
    url.searchParams.append('maxResults', 250);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Transform events to a simpler format
    const events = (data.items || []).map(event => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      return {
        id: event.id,
        summary: event.summary || 'Ingen titel',
        description: event.description || '',
        start: start,
        end: end,
        location: event.location || '',
        attendees: (event.attendees || []).map(a => a.email),
        htmlLink: event.htmlLink,
        isAllDay: !event.start.dateTime,
        status: event.status
      };
    });

    console.log(`📅 Fetched ${events.length} calendar events for next ${weeks} weeks`);
    return events;

  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

/**
 * Get calendar events for today
 */
export async function getTodayCalendarEvents() {
  try {
    const token = await getCalendarAccessToken();

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.append('timeMin', startOfDay.toISOString());
    url.searchParams.append('timeMax', endOfDay.toISOString());
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const events = (data.items || []).map(event => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      return {
        id: event.id,
        summary: event.summary || 'Ingen titel',
        start: start,
        end: end,
        location: event.location || '',
        attendees: (event.attendees || []).map(a => a.email)
      };
    });

    console.log(`📅 Fetched ${events.length} events for today`);
    return events;

  } catch (error) {
    console.error('Error fetching today\'s events:', error);
    throw error;
  }
}

/**
 * Get calendar events for this week
 */
export async function getThisWeekCalendarEvents() {
  try {
    const token = await getCalendarAccessToken();

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    endOfWeek.setHours(23, 59, 59, 999);

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.append('timeMin', startOfWeek.toISOString());
    url.searchParams.append('timeMax', endOfWeek.toISOString());
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const events = (data.items || []).map(event => {
      const start = event.start.dateTime || event.start.date;
      const end = event.end.dateTime || event.end.date;

      return {
        id: event.id,
        summary: event.summary || 'Ingen titel',
        description: event.description || '',
        start: start,
        end: end,
        location: event.location || '',
        attendees: (event.attendees || []).map(a => a.email),
        isAllDay: !event.start.dateTime
      };
    });

    console.log(`📅 Fetched ${events.length} events for this week`);
    return events;

  } catch (error) {
    console.error('Error fetching this week\'s events:', error);
    throw error;
  }
}

/**
 * Format events for AI consumption
 */
export function formatEventsForAI(events) {
  if (!events || events.length === 0) {
    return 'Inga kalenderhändelser hittades.';
  }

  let output = `Hittade ${events.length} kalenderhändelser:\n\n`;

  events.forEach((event, index) => {
    const startDate = new Date(event.start);
    const endDate = new Date(event.end);

    const dateStr = startDate.toLocaleDateString('sv-SE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const timeStr = event.isAllDay
      ? 'Heldag'
      : `${startDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;

    output += `${index + 1}. **${event.summary}**\n`;
    output += `   📅 ${dateStr}\n`;
    output += `   ⏰ ${timeStr}\n`;

    if (event.location) {
      output += `   📍 ${event.location}\n`;
    }

    if (event.description) {
      output += `   📝 ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}\n`;
    }

    if (event.attendees && event.attendees.length > 0) {
      output += `   👥 ${event.attendees.length} deltagare\n`;
    }

    output += '\n';
  });

  return output;
}
