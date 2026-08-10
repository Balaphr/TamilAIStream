# Tamil AI Stream - Visual Website Builder
## Complete Visual Control System

## 🎯 Overview

This is a comprehensive visual website control system that allows complete control over every element, style, and behavior of the Tamil AI Stream website. The builder uses the **same data source** as the live website, ensuring that any changes made in the builder are immediately reflected on the live site after publishing.

## 🏗️ Architecture

### Core Components

1. **site-config.js** - Complete site configuration schema
   - Defines every visible element and its properties
   - Controls content, styling, animations, and behavior
   - Responsive settings for Desktop, Tablet, and Mobile
   - Global site settings (title, description, meta tags)

2. **data-store.js** - Data management layer
   - Manages songs, stations, images, and content
   - Handles localStorage for persistence
   - Provides cross-tab synchronization
   - Backward compatible with legacy code

3. **site-integration.js** - Live site integration
   - Applies configuration to the live website
   - Handles responsive behavior
   - Listens for configuration changes
   - Updates DOM in real-time

4. **builder.html/css/js** - Visual builder interface
   - Visual element selector
   - Property controls for all CSS properties
   - Live preview with device simulation
   - Undo/redo functionality
   - Save draft / Preview / Publish workflow

## 🎨 Features

### Visual Element Selector
- Click any element in the preview to select it
- Visual highlighting of selected elements
- Element tree navigation
- Section-based organization
- Real-time property inspection

### Complete Property Controls
Every aspect of every element can be controlled:

#### Content
- Text content
- Placeholder text
- Title attributes
- HTML content

#### Dimensions
- Width / Height
- Min/Max dimensions
- Aspect ratio

#### Spacing
- Margin (all sides)
- Padding (all sides)
- Individual side control

#### Typography
- Font family
- Font size
- Font weight (300-900)
- Line height
- Letter spacing
- Text alignment

#### Colors
- Text color
- Background color
- Border color
- Gradient support
- Opacity control

#### Borders & Radius
- Border radius
- Border width
- Border style
- Border color

#### Effects
- Glass effect (backdrop blur)
- Box shadows (preset + custom)
- Opacity
- Transitions
- Animations

#### Position
- Position type (static/relative/absolute/fixed/sticky)
- Top/Right/Bottom/Left offsets
- Z-index

#### Animation
- Animation type
- Animation duration
- Hover effects
- Transition effects

#### Visibility
- Display type
- Visibility toggle
- Overflow control
- Responsive visibility

#### Responsive
- Mobile-specific width
- Tablet-specific width
- Hide on mobile
- Hide on tablet

### Section Controls

Each section can be independently controlled:

1. **Startup Splash Screen**
   - Duration, skip button
   - Logo, title, subtitle
   - Equalizer animation
   - Loading bar
   - Background effects

2. **Header & Navigation**
   - Logo text and icon
   - Search bar (placeholder, size, style)
   - Navigation items
   - User actions

3. **Hero Section**
   - Greeting text
   - Featured station
   - Background gradient

4. **Categories Section**
   - Title and layout
   - Card styling
   - Category items

5. **FM Stations Section**
   - Station cards
   - Search and filter
   - Live indicators
   - Pagination

6. **Trending Songs Section**
   - List/grid layout
   - Song cards
   - Scroll controls

7. **Featured Songs Section**
   - Album-style cards
   - Slider controls
   - Play buttons

8. **Recently Added Section**
   - Horizontal scroll
   - Ticker animation

9. **AI Assistant**
   - FAB button
   - Panel width/height
   - Input styling
   - Suggestions

10. **Music Player**
    - Mini player height
    - Control buttons
    - Progress bar
    - Volume control
    - Artwork display

11. **Footer**
    - Text content
    - Links
    - Social media

12. **Toast Notifications**
    - Position
    - Duration
    - Styling

### Advanced Features

#### Undo/Redo
- Full history tracking
- Ctrl+Z / Ctrl+Y shortcuts
- Up to 50 history states

#### Save Draft
- Save work in progress
- Auto-loads on next visit
- Multiple drafts supported

#### Live Preview
- Open in new modal
- See changes in real-time
- Test before publishing

#### Publish
- One-click publish to live site
- Updates shared data source
- Cross-tab synchronization
- Immediate effect on website

#### Reset to Default
- Restore all settings
- Factory reset option
- Confirmation dialog

#### Device Preview
- Desktop (1440px max)
- Tablet (768px)
- Mobile (375px)
- Zoom controls

## 📊 Data Flow

```
┌─────────────┐
│ Builder UI  │
│ (builder)   │
└──────┬──────┘
       │
       │ Save/Publish
       ▼
┌──────────────┐
│ site-config.js│ ← Configuration Schema
└──────┬───────┘
       │
       │ localStorage
       ▼
┌───────────────┐
│ data-store.js │ ← Data Management
└──────┬────────┘
       │
       │ Sync Event
       ▼
┌──────────────────┐
│ site-integration │ ← Live Site Integration
└──────┬───────────┘
       │
       │ Apply Styles
       ▼
┌─────────────┐
│ Live Website│ (index.html)
└─────────────┘
```

## 🚀 Usage

### Starting the Builder

1. Open `builder.html` in a browser
2. The builder loads with the current configuration
3. Click any element in the preview to select it
4. Modify properties in the right panel
5. Click "Preview" to see changes
6. Click "Publish" to make changes live

### Selecting Elements

**Method 1: Visual Selection**
- Click on any element in the preview canvas
- Selected element is highlighted with a green border
- Properties appear in the right panel

**Method 2: Element Tree**
- Use the left sidebar to browse elements
- Click on an element name to select it
- Organized by section

**Method 3: Sections List**
- Browse sections in the left sidebar
- Toggle visibility with the switch
- Click to select entire section

### Editing Properties

1. Select an element
2. Modify properties in the right panel
3. Changes apply immediately to preview
4. Use Undo/Redo if needed
5. Save draft or publish

### Responsive Design

1. Select device (Desktop/Tablet/Mobile)
2. Preview frame resizes accordingly
3. Set device-specific properties
4. Test responsive behavior

### Keyboard Shortcuts

- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
- `Ctrl+S` - Save Draft
- `Delete` - Delete selected element
- `Escape` - Deselect element

## 🔧 Configuration Schema

### Site-wide Settings

```javascript
site: {
    title: string,
    description: string,
    keywords: string,
    ogTitle: string,
    ogDescription: string,
    themeColor: string
}
```

### Section Configuration

Each section has:
```javascript
{
    id: string,           // Unique identifier
    name: string,         // Display name
    visible: boolean,     // Show/hide section
    order: number,        // Display order
    config: {             // Section-specific settings
        // ... properties
    }
}
```

### Element Properties

```javascript
{
    // Content
    textContent: string,
    placeholder: string,
    title: string,
    
    // Dimensions
    width: string,
    height: string,
    minWidth: string,
    maxWidth: string,
    
    // Spacing
    margin: string,
    padding: string,
    marginTop: string,
    marginRight: string,
    marginBottom: string,
    marginLeft: string,
    
    // Typography
    fontFamily: string,
    fontSize: string,
    fontWeight: string,
    lineHeight: string,
    letterSpacing: string,
    textAlign: string,
    
    // Colors
    color: string,
    backgroundColor: string,
    
    // Border
    borderRadius: string,
    borderWidth: string,
    borderColor: string,
    
    // Effects
    opacity: number,
    backdropFilter: string,
    boxShadow: string,
    
    // Position
    position: string,
    top: string,
    right: string,
    bottom: string,
    left: string,
    zIndex: number,
    
    // Animation
    animation: string,
    animationDuration: string,
    hoverEffect: string,
    
    // Visibility
    display: string,
    visibility: string,
    overflow: string,
    
    // Responsive
    mobileWidth: string,
    tabletWidth: string,
    hideMobile: boolean,
    hideTablet: boolean
}
```

## 💾 Data Storage

All configuration is stored in localStorage:

- `siteConfig` - Complete site configuration
- `builderDraft` - Saved drafts
- `tamilAIStream_songs` - Song library
- `tamilAIStream_stations` - FM stations
- `tamilAIStream_images` - Uploaded images
- `tamilAIStream_categories` - Music categories

Data is automatically synchronized across browser tabs via storage events.

## 🔄 Synchronization

The builder uses a real-time sync system:

1. **Builder → localStorage**: Changes saved immediately
2. **localStorage → Live Site**: Storage event triggers update
3. **Cross-tab**: All tabs update simultaneously
4. **Auto-save**: Drafts saved automatically

## 📱 Responsive Behavior

### Desktop (>1024px)
- Full multi-column layouts
- Expanded navigation
- Large preview frame

### Tablet (640px-1024px)
- Reduced columns
- Simplified navigation
- Medium preview frame

### Mobile (<640px)
- Single column
- Hamburger menu
- Compact preview frame
- Touch-optimized controls

## 🎯 Best Practices

1. **Save Frequently**: Use Save Draft often
2. **Preview Before Publishing**: Always preview changes
3. **Test All Devices**: Check Desktop, Tablet, and Mobile
4. **Use Undo**: Don't be afraid to experiment
5. **Reset Carefully**: Reset affects all changes
6. **Backup Data**: Export configuration regularly

## 🔍 Element Selection Tips

- Hover over elements to see their boundaries
- Click precisely on the element you want to edit
- Use the element tree for nested elements
- Check the section info to understand context
- Use browser DevTools for complex selections

## 🐛 Troubleshooting

### Element Not Selectable
- Check if element is inside an iframe
- Verify element is not hidden
- Try selecting parent element

### Changes Not Applying
- Check browser console for errors
- Verify element selector is correct
- Ensure property value is valid

### Preview Not Loading
- Check if index.html is accessible
- Verify path is correct
- Check browser security settings

### Publish Not Working
- Check localStorage is enabled
- Verify browser allows localStorage
- Check for quota limits

## 📚 File Structure

```
Tamil-AI-FM-main/
├── index.html              # Live website
├── builder.html            # Visual builder interface
├── site-config.js          # Complete configuration schema
├── data-store.js           # Data management
├── site-integration.js     # Live site integration
├── builder.css             # Builder styling
├── builder.js              # Builder logic
├── style.css               # Website styles
├── script.js               # Website logic
├── ... (other files)
```

## 🔐 Security Notes

- Builder requires authentication (implement separately)
- All changes are stored client-side
- No server-side code modified
- Consider backup before major changes
- Test changes before publishing

## 🚧 Limitations

- Cannot edit server-side code
- Cannot add new external dependencies
- Some complex animations may need code editing
- Image uploads require separate handler
- Advanced CSS (like @keyframes) need manual setup

## 📞 Support

For issues or questions:
1. Check this documentation
2. Review browser console for errors
3. Test in different browsers
4. Verify localStorage is working

## 🎉 Getting Started

1. Open `builder.html` in your browser
2. Browse the element tree on the left
3. Click an element in the preview
4. Edit properties on the right
5. Click "Preview" to see changes
6. Click "Publish" to go live!

---

**Built with ❤️ for Tamil AI Stream**
