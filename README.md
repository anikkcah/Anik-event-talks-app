# BigQuery Release Notes Hub

A modern web application built with **Flask** (Python) and **Vanilla HTML, CSS, and JavaScript** that aggregates, filters, and shares Google Cloud BigQuery release notes. 

The application resolves the CORS limitations of fetching Google Cloud feeds directly in browsers by utilizing a secure Flask API proxy, parses daily updates into distinct color-coded cards, and provides a customized Tweet composer to share updates on X (Twitter) via Web Intent.

---

## ✨ Features
* **Automated Aggregator**: Dynamically pulls and parses Google's BigQuery release notes Atom feed (`https://docs.cloud.google.com/feeds/bigquery-release-notes.xml`).
* **Daily Splitter**: Breaks down multi-update daily releases into separate, manageable item cards based on classifications like *Features*, *Changes*, *Deprecated*, and *Issues*.
* **Modern Glassmorphic Dark UI**: Custom styling built from scratch with HSL variable palettes, glowing hover states, and smooth entry animations.
* **Integrated Tweet Composer**: Composer modal with real-time character counters, dynamic SVG circle progress indicators, clipboard coping, and Twitter Web Intent integration.
* **Filter Chips & Live Search**: Instantly query updates by keywords or filter by release types.
* **In-place Refresh**: Trigger API calls to fetch notes on-demand with an animated loading spinner and toast notifications.

---

## 🛠️ Project Structure
```text
├── static/
│   ├── css/
│   │   └── style.css      # Glassmorphic dark styling & animations
│   └── js/
│       └── app.js         # Daily note splitter, UI state, and Tweet composer
├── templates/
│   └── index.html         # Main interface, composer modal, and toast alerts
├── app.py                 # Flask server & XML proxy parser
├── .gitignore             # Git exclusion rules
└── README.md              # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
* **Python 3.8+** installed on your system.
* **Git** installed on your system.

### Installation & Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/anikkcah/Anik-event-talks-app.git
   cd Anik-event-talks-app
   ```

2. **Create a Virtual Environment**
   ```bash
   python -m venv venv
   ```

3. **Activate the Virtual Environment**
   * **Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
   * **Windows (Command Prompt)**:
     ```cmd
     .\venv\Scripts\activate.bat
     ```
   * **macOS/Linux**:
     ```bash
     source venv/bin/activate
     ```

4. **Install Dependencies**
   ```bash
   pip install flask requests
   ```

### Running the Application

1. **Start the Flask server**:
   ```bash
   python app.py
   ```
2. **Access in browser**:
   Open your browser and navigate to **[http://127.0.0.1:5000](http://127.0.0.1:5000)**.

---

## 📜 License
This project is open-source and available under the [MIT License](LICENSE).
