const express = require('express');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const axios = require('axios');
require('dotenv').config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 20012;

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')));
app.use('/js', express.static(path.join(__dirname, 'node_modules/jquery/dist')));

// Load configuration
let config;
try {
  if (fs.existsSync(path.join(__dirname, 'config/config.json'))) {
    config = require('./config/config.json');
  } else {
    console.error('Config file not found. Please create config.json based on config.example.json');
    process.exit(1);
  }
} catch (error) {
  console.error('Error loading config:', error);
  process.exit(1);
}

// Lade die Lehrer-Zuordnungen
let teachers = {};
try {
  const teacherPath = path.join(__dirname, 'config/teacher.json');
  if (fs.existsSync(teacherPath)) {
    teachers = JSON.parse(fs.readFileSync(teacherPath, 'utf8'));
    console.log('Teacher mapping loaded successfully');
  } else {
    console.log('No teacher.json found, using empty mapping');
  }
} catch (error) {
  console.error('Error loading teacher.json:', error);
}

// Funktion zum Auflösen des Lehrerkürzels
function resolveTeacher(code) {
  return teachers[code] || code;
}

// Korrekter Import der WebUntis-Bibliothek
const { WebUntis } = require('webuntis');

// WebUntis client setup
let untisClient = null;

// Function to initialize WebUntis client
async function initUntisClient() {
  if (!config.webuntis.school || !config.webuntis.username || !config.webuntis.password || !config.webuntis.baseUrl) {
    console.error('Fehler: Unvollständige WebUntis-Konfiguration. Bitte überprüfen Sie die config.json');
    process.exit(1);
  }

  try {
    // Exakt die gleiche Initialisierung wie im funktionierenden Beispiel
    untisClient = new WebUntis(
      config.webuntis.school,
      config.webuntis.username,
      config.webuntis.password,
      config.webuntis.baseUrl
    );
    
    await untisClient.login();
    console.log('Successfully logged in to WebUntis');
    return true;
  } catch (error) {
    if (error.message && error.message.includes('invalid schoolname')) {
      console.error('Fehler: Ungültiger Schulname. Bitte überprüfen Sie den Schulnamen in der config.json');
    } else {
      console.error('Failed to login to WebUntis:', error);
    }
    return false;
  }
}

// Function to check if a date is a weekend
function isWeekend(date) {
  const day = date.day();
  return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
}

// Function to fetch holidays from WebUntis
async function getHolidays() {
  if (!untisClient) {
    const initialized = await initUntisClient();
    if (!initialized) {
      throw new Error('Failed to initialize WebUntis client');
    }
  }
  
  try {
    // Fetch holidays from WebUntis
    const holidays = await untisClient.getHolidays();
    
    // Process holidays to our format
    return holidays.map(holiday => ({
      name: holiday.name,
      start: moment(holiday.startDate, 'YYYYMMDD').format('YYYY-MM-DD'),
      end: moment(holiday.endDate, 'YYYYMMDD').format('YYYY-MM-DD')
    }));
  } catch (error) {
    console.error('Error fetching holidays:', error);
    // Try to re-login if session expired
    await initUntisClient();
    
    // Return mock data if API fails
    console.log('Using mock holiday data');
    return [
      {
        name: 'Sommerferien',
        start: '2025-07-01',
        end: '2025-08-31'
      },
      {
        name: 'Weihnachtsferien',
        start: '2025-12-23',
        end: '2026-01-06'
      }
    ];
  }
}

// Function to check if a date is a holiday
async function isHoliday(date) {
  try {
    const holidays = await getHolidays();
    const dateStr = date.format('YYYY-MM-DD');
    
    // Check holiday periods
    for (const holiday of holidays) {
      const startDate = moment(holiday.start);
      const endDate = moment(holiday.end);
      
      if (date.isBetween(startDate, endDate, null, '[]')) { // [] means inclusive
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking if date is holiday:', error);
    return false;
  }
}

// Function to get the next school day
async function getNextSchoolDay(date = moment()) {
  let nextDay = date.clone();
  
  // If current day is a school day and it's before 6 PM, return current day
  if (!isWeekend(nextDay) && !(await isHoliday(nextDay)) && nextDay.hour() < 18) {
    return nextDay;
  }
  
  // Otherwise find the next school day
  do {
    nextDay.add(1, 'days');
  } while (isWeekend(nextDay) || (await isHoliday(nextDay)));
  
  return nextDay;
}

// Function to fetch timetable for a specific date
async function getTimetable(date) {
  if (!untisClient) {
    const initialized = await initUntisClient();
    if (!initialized) {
      throw new Error('Failed to initialize WebUntis client');
    }
  }
  
  try {
    let timetable;
    const today = moment().format('YYYY-MM-DD');
    const dateStr = date.format('YYYY-MM-DD');
    
    // Verwende die korrekte Methode basierend auf dem Datum
    if (dateStr === today) {
      // Für heute die getOwnTimetableForToday-Methode verwenden
      console.log('Fetching timetable for today');
      timetable = await untisClient.getOwnTimetableForToday();
    } else {
      // Für andere Tage die allgemeine Methode verwenden
      // Konvertiere das Datum in ein JavaScript Date-Objekt für die WebUntis-API
      console.log(`Fetching timetable for ${dateStr}`);
      
      // Erstelle ein JavaScript Date-Objekt aus dem moment-Objekt
      const jsDate = date.toDate();
      
      try {
        // Versuche mit dem JavaScript Date-Objekt
        if (typeof untisClient.getTimetableFor === 'function') {
          timetable = await untisClient.getTimetableFor(jsDate);
        } else if (typeof untisClient.getOwnTimetableFor === 'function') {
          timetable = await untisClient.getOwnTimetableFor(jsDate);
        } else {
          // Wenn keine passende Methode gefunden wird, verwende die heutige und zeige eine Warnung
          console.warn('Keine passende Methode für Stundenplan an bestimmtem Datum gefunden, verwende heutigen Stundenplan');
          timetable = await untisClient.getOwnTimetableForToday();
        }
      } catch (methodError) {
        console.error('Error with specific timetable method:', methodError);
        // Fallback auf heute
        console.log('Falling back to today\'s timetable');
        timetable = await untisClient.getOwnTimetableForToday();
      }
    }
    
    // Process timetable to highlight changes and cancellations
    const processedTimetable = timetable.map(lesson => {
      return {
        ...lesson,
        isCancelled: lesson.code === 'cancelled',
        isChanged: lesson.substText || lesson.info || false
      };
    });
    
    return processedTimetable;
  } catch (error) {
    console.error('Error fetching timetable:', error);
    // Try to re-login if session expired
    await initUntisClient();
    
    // Return mock data if API fails
    console.log('Using mock timetable data');
    return [
      {
        id: 1,
        startTime: 800,
        endTime: 845,
        su: [{ name: 'Mathematik' }],
        te: [{ name: 'Herr Müller' }],
        ro: [{ name: 'R101' }],
        code: '',
        info: ''
      },
      {
        id: 2,
        startTime: 855,
        endTime: 940,
        su: [{ name: 'Deutsch' }],
        te: [{ name: 'Frau Schmidt' }],
        ro: [{ name: 'R102' }],
        code: '',
        info: ''
      },
      {
        id: 3,
        startTime: 955,
        endTime: 1040,
        su: [{ name: 'Englisch' }],
        te: [{ name: 'Herr Weber' }],
        ro: [{ name: 'R103' }],
        code: 'cancelled',
        info: 'Lehrkraft krank'
      },
      {
        id: 4,
        startTime: 1050,
        endTime: 1135,
        su: [{ name: 'Physik' }],
        te: [{ name: 'Frau Becker' }],
        ro: [{ name: 'R104' }],
        code: '',
        substText: 'Vertretung durch Herrn Schulz',
        info: 'Raumänderung'
      }
    ];
  }
}

// Function to get assignments (using mock data since the API doesn't support homework methods)
async function getAssignments() {
  console.log('Using mock homework data');
  return [
    {
      subject: 'Technik',
      description: 'KA',
      dueDate: '2025-05-19'
    },
    {
      subject: 'Chemie',
      description: 'KA',
      dueDate: '2025-05-27'
    }
  ];
}

// Funktion zum Formatieren der Zeit
function formatTime(time) {
  const timeStr = time.toString().padStart(4, '0');
  return `${timeStr.slice(0, 2)}:${timeStr.slice(2)}`;
}

// Routes
app.get('/', async (req, res) => {
  try {
    const nextSchoolDay = await getNextSchoolDay();
    let timetable = await getTimetable(nextSchoolDay);
    const assignments = await getAssignments();
    
    // Sortiere den Stundenplan nach Startzeit
    timetable = [...timetable].sort((a, b) => a.startTime - b.startTime);
    
    // Aktuelle Zeit für Hervorhebung der laufenden Stunde
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    // Füge Informationen zur aktuellen Stunde hinzu
    timetable = timetable.map(lesson => {
      // Berechne Start- und Endzeit der Stunde in Minuten
      const startHour = parseInt(lesson.startTime.toString().padStart(4, '0').slice(0, 2));
      const startMinute = parseInt(lesson.startTime.toString().padStart(4, '0').slice(2));
      const startTimeInMinutes = startHour * 60 + startMinute;
      
      const endHour = parseInt(lesson.endTime.toString().padStart(4, '0').slice(0, 2));
      const endMinute = parseInt(lesson.endTime.toString().padStart(4, '0').slice(2));
      const endTimeInMinutes = endHour * 60 + endMinute;
      
      // Prüfe, ob diese Stunde gerade läuft
      const isCurrentLesson = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
      
      return {
        ...lesson,
        isCurrentLesson,
        formattedStartTime: formatTime(lesson.startTime),
        formattedEndTime: formatTime(lesson.endTime),
        teacherName: lesson.te && lesson.te[0] ? resolveTeacher(lesson.te[0].name) : 'Unbekannt'
      };
    });
    
    res.render('index', {
      timetable,
      assignments,
      nextSchoolDay: nextSchoolDay.format('DD.MM.YYYY'),
      refreshInterval: config.refreshInterval || 30000,
      currentTime: now.toLocaleTimeString('de-DE')
    });
  } catch (error) {
    console.error('Error rendering index:', error);
    res.render('error', { error: error.message });
  }
});

// API route to get timetable data
app.get('/api/timetable', async (req, res) => {
  try {
    const nextSchoolDay = await getNextSchoolDay();
    const timetable = await getTimetable(nextSchoolDay);
    
    res.json({
      date: nextSchoolDay.format('DD.MM.YYYY'),
      timetable
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API route to get assignments
app.get('/api/assignments', async (req, res) => {
  try {
    const assignments = await getAssignments();
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  // Initialize WebUntis client on startup
  initUntisClient().then(success => {
    if (success) {
      console.log('WebUntis client initialized successfully');
    } else {
      console.log('WebUntis client initialization failed, will use mock data');
    }
  });
});
