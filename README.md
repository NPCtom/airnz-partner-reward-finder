# Air NZ Partner Reward Finder

https://github.com/user-attachments/assets/e9454491-5319-40d8-9f69-8f14dddfcc02

👋 As a side project I wanted to see if I could automate some of the repetitive searching involved in looking for Air New Zealand Star Alliance reward fares.

This Chrome extension is a proof of concept only. It scans across multiple dates (±4 weeks) and highlights when business class rewards are available. 

## Features
- Displays a small user interface on the reward portal.
- Scans across available dates and shows status updates.
- Fixes the "Service unavailable" error that apeears on some searches.
- Log to console and export to CSV.
- Compatible with Chrome.

## Installation
1. [Clone or download this repo](https://github.com/NPCtom/airnz-partner-reward-finder/archive/refs/heads/main.zip).
2. Go to `chrome://extensions/` in your Chrome browser.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the extension folder. You will need to unzip the file before doing this.

## How to Use

1. Navigate to the [partner booking portal](https://www.airnewzealand.co.nz/partner-reward-flights/search-flight).
2. Enter your journey and travel date you'd like to travel around. Click **Search**.  
   ![Search page](https://i.imgur.com/kdq1EPf.png)
3. Ensure you click on **Show dates** for each new search, otherwise the tool will search using the dates from the previous search.  
   ![Show dates](https://i.imgur.com/hMKsRrk.png)
4. Use the tool and scan for your desired seats.  
   ![Scan results](https://i.imgur.com/RuDdaGg.png)

Note: This project is not affiliated with Air NZ and is intended for educational/personal use only.
