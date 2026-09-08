# Claude AI Custom Connector Guide

Connect **Claude AI** (via claude.ai Custom Connector, Projects, or Claude Desktop MCP) to your inventory webapp to manage your Daraz listings, drafts, variations, categories, and specifications using plain English!

---

## 1. What You Can Say in Claude AI

You can type naturally in Claude chat to manage your Daraz listings and inventory:

### 🎨 1. Add Product with Variations & Special Price
> **Prompt:** *"Add Product Name A with variation of Black and Red at price rs 450 for both. Category is Kitchen Cookware. Save in draft for Bagmati"*  
> **What Claude & Connector do:**
> - Recognizes `450` as the **Special Price** (customer discount selling price).
> - Auto-calculates the **Regular MRP Price** (~25% markup, e.g. Rs 570) so Daraz displays a proper discount.
> - Automatically generates unique **Seller SKUs** for each variation (e.g. `PROD-NAME-A-BLACK-7281` and `PROD-NAME-A-RED-3849`).
> - Sets stock to **100** by default.
> - Formats highlights with bullet points (`• `).
> - Saves the category, specifications, and variation matrix directly into your database draft!

---

### 📝 2. Save Draft with Specifications & Categories
> **Prompt:** *"Save a draft for Stainless Steel Electric Kettle, category Electric Kettles, brand No Brand, material 304 Stainless Steel, capacity 2L, price rs 1200 for Balaju Shop and Bagmati Traders"*  
> **What Claude does:**
> - Saves category ID/path and all dynamic specifications (`attributes: { brand: 'No Brand', material: '304 Stainless Steel', capacity: '2L' }`) directly to the database.
> - Creates SEO titles for both stores in a single draft.
> - Prepares clean formatted HTML descriptions (`<p>`, `<strong>`) without messy code clutter.

---

### ✏️ 3. Edit / Update Existing Draft via Claude
> **Prompt:** *"In draft Product Name A, change the price of Black to rs 500 and add variation Blue"*  
> *(or: "Update draft Stainless Steel Kettle to add specification color: Matte Black")*  
> **What Claude does:**
> - Uses `update_product_draft` to locate the draft by name or ID and updates its variants, specifications, prices, or descriptions in real-time.

---

### 🔍 4. View Full Product Draft Details
> **Prompt:** *"Show me full details and variants of draft Product Name A"*  
> **What Claude does:**
> - Uses `get_draft_details` to return all SKU rows, variation attributes, store titles, prices, and specifications for your review.

---

### 🗑️ 5. Delete a Draft Listing
> **Prompt:** *"Delete the draft for Product Name A"*  
> **What Claude does:**
> - Uses `delete_product_draft` to remove the draft from the database.

---

### 📦 6. Bulk Add Arrived Inventory
> **Prompt:** *"New products arrived: 10 Cotton Shirts at 450, 20 Slim Denim Jeans at 900. Save in draft for Bagmati"*  
> **What Claude does:**
> - Creates multiple draft rows simultaneously in your webapp database with proper pricing markup and stock 100.

---

### 🚀 7. Push Directly to Daraz
> **Prompt:** *"Push Product Name A to Daraz store Bagmati Traders"*  
> **What Claude does:**
> - Builds Daraz multi-SKU payload with all variants, specifications, bullet points (`• `), and HTML descriptions and sends to the Daraz Open API!

---

### 🏪 8. Query Connected Daraz Accounts
> **Prompt:** *"Which Daraz accounts are currently connected to my webapp?"*  
> **What Claude does:** Lists all active seller accounts (e.g. *Bagmati Traders*, *BTAS*, *Cosmetic Shop*, etc.).

---

### 👁️ 10. Visual Product Image Inspection (Claude Vision)
> **Prompt:** *"Check my image-only drafts, look at the product images, and generate the product title, description, highlights, and category"*  
> **What Claude does:**
> - Calls `get_draft_listings(type: 'image_only')` to find pending image-only drafts.
> - Calls `view_draft_images(id)` or `get_draft_details(id)`.
> - The connector downloads the high-res image from Supabase/CDN, optimizes it, and passes it directly into Claude's visual context as a native MCP image block!
> - Claude **visually inspects the actual product image** (appearance, color, design, branding, specifications) and generates the full listing details.

---

### ⚡ 11. Extract Competitor Product Links
> **Prompt:** *"Check this competitor link https://www.daraz.com.np/products/... and generate a draft"*  
> **What Claude does:**
> - Uses `extract_product_link` to scrape competitor title, pricing, high-res images, description, highlights, and matching Daraz category path.
> - Can save or update draft directly.

---

## 2. Core Rules Implemented in the Connector

| Feature | How It Works |
|---|---|
| **Pricing** | When you tell Claude a price (e.g. `450`), this is treated as the **Special Price** (your selling/promotional price). The connector automatically marks up the regular MRP (e.g. `570`) so Daraz displays a discount badge. |
| **Stock** | Every SKU and variant default stock is set to **100**. |
| **Seller SKU** | Automatically generated per variant (e.g. `PROD-BLACK-4821`). |
| **Highlights** | Every bullet point is guaranteed to start with `• `. |
| **Description** | Formatted using paragraphs (`<p>`) and bold tags (`<strong>`), ensuring clean readable view in the webapp and rich rendering on Daraz. |
| **Variants in Webapp** | When you open a draft in the webapp, all variants created by Claude are automatically restored into the "Price, Stock & Variants" table. |

---

## 3. Setting Up in Claude.ai (Custom Connector)

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
5. Save the connector. Claude will automatically detect all 9 tools:
   - `search_daraz_categories` (look up official Daraz leaf categories)
   - `save_product_draft`
   - `update_product_draft`
   - `delete_product_draft`
   - `get_draft_details`
   - `get_draft_listings`
   - `push_product_to_daraz`
   - `bulk_add_products`
   - `list_daraz_stores`

---

## 4. Setting Up in Claude Desktop (MCP)

If you use the **Claude Desktop App**, you can connect via the Model Context Protocol (MCP):

1. Open your Claude Desktop configuration file:
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add the connector configuration:
   ```json
   {
     "mcpServers": {
       "daraz-inventory": {
         "command": "npx",
         "args": [
           "-y",
           "mcp-remote",
           "https://madelaine-unaged-napoleon.ngrok-free.dev/api/claude-connector"
         ]
       }
     }
   }
   ```

---

## 5. Security & Authorization (Optional)

To secure the connector:
1. In `.env.local`:
   ```env
   CLAUDE_CONNECTOR_API_KEY=your-secret-password-or-token
   ```
2. Include header in Claude requests:
   ```
   Authorization: Bearer your-secret-password-or-token
   ```
*(If unset, the endpoint allows requests for smooth development and testing).*
