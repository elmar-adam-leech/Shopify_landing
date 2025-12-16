# Design Guidelines: Shopify Page Builder App

## Design Approach
**System Selected:** Shopify Polaris Design System

**Rationale:** As an embedded Shopify admin app, this must feel native to merchants. Polaris provides the established patterns, components, and interaction models that Shopify merchants expect, ensuring zero learning curve for navigation and controls.

**Key Principles:**
- Merchant-focused utility: Prioritize efficiency and clarity over visual flair
- Native integration: Seamless match with Shopify admin aesthetic
- Drag-and-drop clarity: Visual feedback for all interactive states
- Dense information architecture: Pack functionality without overwhelming

---

## Typography System

**Font Family:** SF Pro (Shopify Polaris default)

**Hierarchy:**
- Page titles: 20px/semibold (Polaris Heading)
- Section headers: 16px/semibold (Polaris Subheading)
- Component labels: 14px/medium
- Body text: 14px/regular
- Helper text: 12px/regular, subtle styling
- Canvas preview text: Scales based on component type (16-24px for headings, 14px for body)

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8 for consistency
- Component padding: p-4
- Section spacing: gap-6, mb-6
- Tight groupings: gap-2
- Canvas margins: p-8

**Grid Structure:**
- Editor: Sidebar (320px fixed) + Canvas (flex-1)
- Sidebar components: Stack vertically with gap-4
- Canvas: Center-aligned container, max-w-5xl
- Settings panels: 2-column grids for form fields (grid-cols-2 gap-4)

---

## Core Layout Structure

### Main Editor View
**Left Sidebar (320px fixed width):**
- Header with app logo/title (h-16, border-b)
- Component Library section with search filter
- Draggable block cards (rounded-lg, border, p-4, hover state)
- Grouped by category: Content, Products, Forms, Tracking
- Sticky positioning during scroll

**Canvas Area (flex-1):**
- Toolbar at top: Save, Preview, Settings buttons (h-14, border-b)
- Scrollable workspace with centered page preview (max-w-5xl mx-auto p-8)
- Dropzone with dashed border when empty
- Dropped components with subtle borders, drag handles, and action menus
- Component hover: Show edit/delete icons, highlight border

### Settings Panels (Modal/Drawer)
**Pixel Integration Panel:**
- Tabs for each platform (Meta, Google, TikTok, Pinterest)
- Code input fields with syntax highlighting suggestion
- Toggle switches for event types (PageView, AddToCart, Purchase)
- Test/validation status indicators

**Component Settings (Right Drawer, 400px):**
- Property editors based on component type
- Shopify resource pickers (products, collections) with Polaris ResourcePicker
- Form builders with field type dropdowns
- Preview thumbnail of changes

---

## Component Library Design

**Draggable Block Cards:**
- Icon (24px) + Label + Description
- Rounded corners (rounded-lg)
- Border with subtle shadow
- Drag handle indicator (6 dots icon)
- Categorized sections: "Content Blocks", "Product Blocks", "Conversion Blocks", "Tracking & Chat"

**Component Types:**
1. Hero Banner: Image placeholder + text overlay controls
2. Product Grid: Dynamic product cards (2-4 columns selector)
3. Text Block: Rich text editor preview
4. Form Block: Field list with add/remove controls
5. Phone Block: Number display + tracking service selector
6. Chat Block: Shopify Inbox widget preview

---

## Canvas Component States

**Empty State:**
- Centered illustration + "Drag components here" message
- Dashed border outline (border-dashed, border-2)

**Dropped Components:**
- Full-width containers with inner padding (p-6)
- Top toolbar: Drag handle (left) + Settings icon + Delete icon (right)
- Border on hover (border-2)
- Active/selected state: Blue accent border
- Reorder indicator: Blue line showing drop position

**Preview Mode:**
- Hide all editing controls
- Full component rendering as end-user would see
- Responsive breakpoint toggle (mobile/tablet/desktop)

---

## Navigation & Actions

**Top Toolbar:**
- Left: Back to Pages list link
- Center: Page title (editable inline)
- Right: Preview button, Save draft button (secondary), Publish button (primary)

**Contextual Menus:**
- Component settings (gear icon)
- Duplicate component
- Delete (trash icon, requires confirmation for non-empty components)

---

## Form & Input Styling

- Use Polaris TextField, Select, Checkbox components exclusively
- Form layouts: Vertical stack (gap-4) for mobile, grid-cols-2 for desktop settings
- Required field indicators: Red asterisk
- Validation: Inline error messages below fields (text-sm, error color from Polaris)
- Help text: Below inputs, subtle styling

---

## Responsive Behavior

**Desktop (1024px+):** Full sidebar + canvas layout
**Tablet (768-1023px):** Collapsible sidebar with toggle button
**Mobile (<768px):** Bottom drawer for component library, full-width canvas

---

## Accessibility

- All drag-drop actions have keyboard alternatives
- Focus indicators on all interactive elements
- ARIA labels for icon-only buttons
- Screen reader announcements for component additions/deletions
- Color contrast meeting WCAG AA standards (handled by Polaris)

---

## Images

**Component Library Icons:** Use Polaris icon set (Layout, Products, Text, Form, Phone, Chat icons)

**Empty States:** Polaris illustration style for "No components yet" and "Configure pixel tracking"

**No hero images required** - this is a utility app focused on merchant workflow, not marketing.