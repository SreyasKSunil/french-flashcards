French Flashcards Web App

A simple, fast, browser-based flashcard web app to learn French.
Runs fully in the browser. No Node.js. No backend.
Works on laptop and iPhone.
Designed to be hosted on GitHub Pages.

Features
- Import flashcards from CSV exported from Excel or Google Sheets
- Flashcards with flip interaction
- Text-to-speech audio for French words and example sentences
- Dark mode and light mode, both with gradient themes
- Mobile-first layout
  - Flashcard at the top on phones
  - Flashcard on the left on laptops
- Progress saved locally in the browser
- Keyboard and touch friendly

CSV format

Required columns
- fr   French word or sentence
- en   English meaning

Optional columns
- example   French example sentence
- tags      Any tags, comma separated

Example CSV

fr,en,example,tags
Bonjour,Hello,"Bonjour, comment ça va ?",daily,greetings
Merci,Thank you,"Merci pour votre aide.",polite
Rendez-vous,Appointment,"J'ai un rendez-vous à 15h.",work

How to use
1. Prepare your words in Excel or Google Sheets
2. Use the column headers exactly as shown above
3. Export the file as CSV
4. Open the web app
5. Import the CSV file
6. Tap the card to flip
7. Use Speak to hear French pronunciation

Audio
- Audio uses the browser Text to Speech engine
- On iPhone, French voices depend on installed system voices
- To add voices on iPhone
  - Settings
  - Accessibility
  - Spoken Content
  - Voices
  - Download a French voice

Hosting on GitHub Pages
1. Create a new GitHub repository
2. Upload these files to the root
   - index.html
   - styles.css
   - app.js
   - README.md
   - LICENSE
3. Go to Settings → Pages
4. Source: Deploy from a branch
5. Branch: main
6. Folder: root
7. Save and open the provided URL

Local usage
- You can also open index.html directly in a browser
- Progress is stored locally per device and browser

Limitations
- Progress does not sync across devices
- Audio quality depends on system voices
- CSV is recommended. XML not included by default

Roadmap ideas
- Spaced repetition scheduling
- XML import
- Multiple decks
- Cloud sync

Author
Personal learning project for French language practice.

License
MIT License
