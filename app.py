import logging
from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_and_parse_feed():
    try:
        logger.info(f"Fetching release notes from {FEED_URL}")
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(FEED_URL, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Parse the Atom feed XML
        root = ET.fromstring(response.content)
        
        # Namespace mapping for Atom
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        
        # Extract feed metadata
        feed_title = root.find("atom:title", ns)
        feed_title_text = feed_title.text if feed_title is not None else "BigQuery Release Notes"
        
        entries = []
        for entry_elem in root.findall("atom:entry", ns):
            title = entry_elem.find("atom:title", ns)
            updated = entry_elem.find("atom:updated", ns)
            id_elem = entry_elem.find("atom:id", ns)
            
            # Find alternate link
            link = entry_elem.find("atom:link[@rel='alternate']", ns)
            if link is None:
                link = entry_elem.find("atom:link", ns)
            
            content = entry_elem.find("atom:content", ns)
            
            entries.append({
                "id": id_elem.text if id_elem is not None else "",
                "date": title.text if title is not None else "",
                "updated_iso": updated.text if updated is not None else "",
                "link": link.attrib.get("href", "") if link is not None else "",
                "content_html": content.text if content is not None else ""
            })
            
        return {
            "success": True,
            "feed_title": feed_title_text,
            "entries": entries
        }
    except Exception as e:
        logger.exception("Error fetching or parsing the XML feed")
        return {
            "success": False,
            "error": str(e)
        }

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def release_notes_api():
    result = fetch_and_parse_feed()
    if result["success"]:
        return jsonify(result)
    else:
        return jsonify(result), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
