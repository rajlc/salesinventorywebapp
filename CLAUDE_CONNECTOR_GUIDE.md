# Claude AI Custom Connector Guide

Connect **Claude AI** (via claude.ai Custom Connector or Claude Desktop MCP) to your inventory webapp to manage your Daraz listings using plain English!

---

## 1. What You Can Say in Claude AI

You can type naturally in Claude chat to manage your Daraz listings and inventory:

### 📝 1. Save in Draft (Single Product)
> **Prompt:** *"Add Product A at price rs 500 in daraz account Bagmati, save only in draft"*  
> **What Claude does:** Automatically connects to your webapp and creates a draft in your database under **Bagmati Traders**. It immediately shows up in your **New Listing &rarr; Drafts** table in the webapp!

### 📦 2. Bulk Add Arrived Inventory
> **Prompt:** *"New products arrived: 10 Cotton Shirts at 450, 20 Slim Denim Jeans at 900. Save in draft for Bagmati"*  
> **What Claude does:** Creates multiple draft rows simultaneously in your webapp inventory.

### 🚀 3. Push Directly to Daraz
> **Prompt:** *"Add Product A at price rs 500 in daraz account Bagmati, push product in daraz"*  
> **What Claude does:** Matches the category, auto-generates SEO titles, rich description, and bullet highlights, and connects with the Daraz Open API to push to your seller account!  
> *(Note: If no image URL is provided, Claude will prepare the draft as "Ready" and prompt you to attach a product image in the webapp).*

### 🏪 4. Query Connected Daraz Accounts
> **Prompt:** *"Which Daraz accounts are currently connected to my webapp?"*  
> **What Claude does:** Lists all active seller accounts (e.g. *Bagmati Traders*, *BTAS*, *Cosmetic Shop*, etc.).

### 📋 5. Check Draft Statuses
> **Prompt:** *"Show me my recent drafts and their status"*  
> **What Claude does:** Displays current drafts and whether they are `draft`, `generated`, `pushed`, or `failed`.

---

## 2. Setting Up in Claude.ai (Custom Connector)

### Step 1: Your Connector URL
Your app provides two public endpoints:
- **Universal Tool Runner:** `https://madelaine-unaged-napoleon.ngrok-free.dev/api/claude-connector`
- **OpenAPI 3.0 Specification:** `https://madelaine-unaged-napoleon.ngrok-free.dev/api/claude-connector/openapi`

*(If running locally without ngrok, replace with your domain or local tunnel).*

### Step 2: Add to Claude.ai
1. Log in to [Claude.ai](https://claude.ai).
2. Go to **Settings &rarr; Integrations** or **Custom Connectors** (or in a Project, click **Add Tools / Connectors**).
3. Select **Add Custom Connector / MCP Server**.
4. Paste the connector URL:
   ```
   https://madelaine-unaged-napoleon.ngrok-free.dev/api/claude-connector
   ```
   *(Note: Both `/api/claude-connector` and `/api/claude-connector/openapi` are supported).*
5. Save the connector. Claude will automatically detect all 5 tools (`list_daraz_stores`, `save_product_draft`, `bulk_add_products`, `push_product_to_daraz`, `get_draft_listings`).

---

## 3. Setting Up in Claude Desktop (MCP)

If you use the **Claude Desktop App**, you can connect via the Model Context Protocol (MCP):

1. Open your Claude Desktop configuration file:
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the connector configuration:
   ```json
   {
     "mcpServers": {
       "daraz-inventory": {
         "command": "node",
         "args": [
           "-e",
           "const url = 'http://localhost:3000/api/claude-connector'; ... "
         ]
       }
     }
   }
   ```
   Or use an HTTP SSE proxy pointing to `http://localhost:3000/api/claude-connector`.

---

## 4. Optional Security (API Key)

To protect your connector from unauthorized requests:

1. Open `.env.local` and add:
   ```env
   CLAUDE_CONNECTOR_API_KEY=your-secret-password-or-token
   ```
2. When configuring Claude or sending requests, include the header:
   ```
   Authorization: Bearer your-secret-password-or-token
   ```
   *(If `CLAUDE_CONNECTOR_API_KEY` is omitted, the endpoint is open for easy local testing).*

---

## 5. Summary of Built-in Tools

| Tool Name | Purpose | Example Input |
|---|---|---|
| `save_product_draft` | Save product draft in database | `{ raw_name: "Product A", price: 500, store_account_name: "Bagmati" }` |
| `bulk_add_products` | Bulk save multiple items | `{ store_account_name: "Bagmati", products: [{ name: "Item 1", price: 300 }] }` |
| `push_product_to_daraz` | Create and publish to Daraz | `{ product_name: "Product A", price: 500, store_account_name: "Bagmati" }` |
| `list_daraz_stores` | List all connected Daraz stores | `{}` |
| `get_draft_listings` | View drafts and push statuses | `{ status: "draft", limit: 10 }` |
