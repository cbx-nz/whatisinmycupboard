# Stock Keeper 🧊

A home inventory management system designed for Raspberry Pi touchscreens and LAN access. Keep track of what's in your freezers, fridges, cupboards, and more!

## Features

- **📍 Custom Locations** - Create as many storage locations as you need (Kitchen Freezer, Garage Freezer, etc.)
- **📱 Dual Interface** - Touch-optimized UI for small screens + full dashboard for phones/desktops
- **⏰ Expiry Tracking** - Get alerts for expired and soon-to-expire items
- **📷 Photo Support** - Take photos of items with your device camera
- **🔌 Offline First** - Works completely offline, no internet required
- **💾 Local Database** - SQLite database stored locally

## Screenshots

| Touch UI | Dashboard |
|----------|-----------|
| Large buttons for touchscreens | Full-featured for desktop/phone |

## Requirements

- Node.js 18+ 
- npm

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/stock-keeper.git
   cd stock-keeper
   ```

2. Install dependencies:
   ```bash
   cd app
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open in browser:
   - **Touch UI**: http://localhost/touch
   - **Dashboard**: http://localhost/dashboard

## Configuration

Create a `.env` file in the `/app` directory:

```env
PORT=80
```

## Usage

### Adding Locations

1. Go to Dashboard → Manage Locations
2. Enter a name (e.g., "Garage Freezer")
3. Select type, icon, and color
4. Click "Add Location"

### Adding Items

1. Navigate to a location
2. Click the + button
3. Fill in item details (name, quantity, expiry date)
4. Optionally take a photo
5. Save

### Managing Expiry

- Items expiring within 3 days show warnings
- Expired items are highlighted in red
- View all alerts from the Alerts page

## Raspberry Pi Setup

For a dedicated touchscreen kiosk:

1. Install Raspberry Pi OS Lite
2. Install Node.js:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. Clone and install the app
4. Set up auto-start with systemd:
   ```bash
   sudo nano /etc/systemd/system/stockkeeper.service
   ```
   ```ini
   [Unit]
   Description=Stock Keeper
   After=network.target

   [Service]
   ExecStart=/usr/bin/node /home/pi/stock-keeper/app/server.js
   WorkingDirectory=/home/pi/stock-keeper/app
   Restart=always
   User=pi

   [Install]
   WantedBy=multi-user.target
   ```
5. Enable and start:
   ```bash
   sudo systemctl enable stockkeeper
   sudo systemctl start stockkeeper
   ```

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite (via sql.js - pure JavaScript)
- **Templating**: EJS
- **Frontend**: Vanilla CSS & JavaScript

## Project Structure

```
whatisinmycupboard/
├── app/
│   ├── db/
│   │   ├── database.js    # Database operations
│   │   ├── schema.sql     # Database schema
│   │   └── stock-keeper.db # SQLite database (generated)
│   ├── public/
│   │   ├── css/           # Stylesheets
│   │   ├── js/            # Client-side JavaScript
│   │   └── uploads/       # Uploaded images
│   ├── routes/
│   │   ├── api.js         # JSON API routes
│   │   └── items.js       # Page routes
│   ├── views/
│   │   ├── dashboard/     # Dashboard templates
│   │   ├── touch/         # Touch UI templates
│   │   └── partials/      # Shared partials
│   ├── server.js          # Main server file
│   └── package.json
├── .gitignore
└── README.md
```

## License

MIT License - feel free to use and modify!

## Contributing

Pull requests welcome! Please open an issue first to discuss changes.
