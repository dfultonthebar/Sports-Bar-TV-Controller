
# Sports Bar AI Assistant - Color Scheme Standard

## Design Philosophy
Dark theme with high contrast for excellent readability in sports bar environments with variable lighting conditions.

## Color Palette

### Background Colors
- **Primary Background**: `bg-slate-900` - Main page background
- **Secondary Background**: `bg-slate-800` - Card backgrounds
- **Tertiary Background**: `bg-slate-700` - Nested element backgrounds
- **Hover States**: `hover:bg-slate-700`, `hover:bg-slate-600`

### Text Colors
- **Primary Text**: `text-slate-100` - Headings, important text
- **Secondary Text**: `text-slate-200` - Subheadings, labels
- **Tertiary Text**: `text-slate-300` - Descriptions, hints
- **Muted Text**: `text-slate-400` - Disabled, less important text
- **Placeholder Text**: `text-slate-500`

### Accent Colors

#### Blue (Primary Actions, DirecTV, General Features)
- **Bright**: `text-blue-400`, `bg-blue-400`
- **Medium**: `text-blue-500`, `bg-blue-500`
- **Dark**: `text-blue-600`, `bg-blue-600`
- **Badge/Alert**: `bg-blue-900/50`, `text-blue-200`, `border-blue-800`
- **Gradient**: `from-blue-900/40 to-purple-900/40`

#### Purple (AI Features, Enhanced Capabilities)
- **Bright**: `text-purple-400`, `bg-purple-400`
- **Medium**: `text-purple-500`, `bg-purple-500`
- **Badge**: `bg-purple-900/50`, `text-purple-200`, `border-purple-800`

#### Teal (Audio, Atlas System)
- **Bright**: `text-teal-400`, `bg-teal-400`
- **Medium**: `text-teal-500`, `bg-teal-500`

#### Green (Success, Online Status)
- **Bright**: `text-green-400`, `bg-green-400`
- **Badge**: `bg-green-900/50`, `text-green-200`, `border-green-800`

#### Red (Errors, Offline Status)
- **Bright**: `text-red-400`, `bg-red-400`
- **Badge**: `bg-red-900/50`, `text-red-200`, `border-red-800`

#### Yellow/Orange (Warnings)
- **Bright**: `text-yellow-400`, `text-orange-400`
- **Badge**: `bg-yellow-900/50`, `text-yellow-200`, `border-yellow-800`

### Border Colors
- **Default**: `border-slate-700`
- **Accent**: `border-blue-600/50`, `border-purple-600/50`
- **Focus**: `focus:border-blue-500`, `focus:ring-blue-500`

### Component Patterns

#### Cards
```tsx
<Card className="bg-slate-800 border-slate-700">
  <CardHeader>
    <CardTitle className="text-slate-100">Title</CardTitle>
    <CardDescription className="text-slate-300">Description</CardDescription>
  </CardHeader>
  <CardContent className="text-slate-200">
    Content
  </CardContent>
</Card>
```

#### Buttons
```tsx
// Primary Button
<Button className="bg-blue-600 hover:bg-blue-700 text-slate-100">
  Primary Action
</Button>

// Secondary Button
<Button variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
  Secondary Action
</Button>

// Destructive Button
<Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-slate-100">
  Delete
</Button>
```

#### Badges
```tsx
// Status Badges
<Badge className="bg-green-900/50 text-green-200 border-green-800">
  Online
</Badge>

<Badge className="bg-blue-900/50 text-blue-200 border-blue-800">
  Active
</Badge>

<Badge className="bg-red-900/50 text-red-200 border-red-800">
  Offline
</Badge>
```

#### Input Fields
```tsx
<input className="bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500" />
```

#### Tabs
```tsx
<TabsList className="bg-slate-800 border-slate-700">
  <TabsTrigger className="text-slate-300 data-[state=active]:bg-slate-700 data-[state=active]:text-slate-100">
    Tab
  </TabsTrigger>
</TabsList>
```

#### Section Headers
```tsx
<div className="flex items-center gap-3 mb-4">
  <IconComponent className="w-6 h-6 text-blue-400" />
  <h2 className="text-2xl font-bold text-slate-100">Section Title</h2>
</div>
```

#### AI Enhancement Banners
```tsx
<div className="card p-4 border-blue-600/50 bg-gradient-to-r from-blue-900/40 to-purple-900/40">
  <div className="flex items-center gap-3">
    <Brain className="w-6 h-6 text-blue-400" />
    <div>
      <h3 className="font-semibold text-blue-200">AI Feature Title</h3>
      <p className="text-sm text-blue-300">Description</p>
    </div>
  </div>
</div>
```

## Rules to Follow

### Text Contrast
1. **White backgrounds** → Replace with `bg-slate-800` or `bg-slate-700`
2. **Black text** → Replace with `text-slate-100` or `text-slate-200`
3. **Gray-500 or darker text** → Replace with lighter alternatives (`text-slate-200`, `text-slate-300`)

### Component Styling
1. Cards should use `bg-slate-800` with `border-slate-700`
2. Nested cards can use `bg-slate-700`
3. Icons should use accent colors (`text-blue-400`, `text-purple-400`, etc.)
4. Headings should use `text-slate-100`
5. Body text should use `text-slate-200`
6. Secondary text should use `text-slate-300`

### Interactive Elements
1. Buttons should have clear hover states (`hover:bg-slate-700`)
2. Focus states should use blue accent (`focus:border-blue-500`)
3. Disabled states should use `text-slate-500` and `opacity-50`

### Status Indicators
1. Online/Success: Green (`text-green-400`, `bg-green-900/50`)
2. Offline/Error: Red (`text-red-400`, `bg-red-900/50`)
3. Active/Info: Blue (`text-blue-400`, `bg-blue-900/50`)
4. Warning: Yellow/Orange (`text-yellow-400`, `bg-yellow-900/50`)
5. AI Features: Purple (`text-purple-400`, `bg-purple-900/50`)

### Gradients
Use for special sections like AI features:
- `from-blue-900/40 to-purple-900/40`
- `from-slate-800 to-slate-900`

## Anti-Patterns (Do NOT Use)

❌ `bg-white` - Use `bg-slate-800` instead
❌ `text-black` or `text-gray-900` - Use `text-slate-100` instead
❌ `text-gray-500` - Use `text-slate-300` or `text-slate-400` instead
❌ Pure white cards in dark theme
❌ Low contrast text on light backgrounds
❌ Inconsistent accent colors (stick to blue/purple/teal/green/red)

## Accessibility Standards

1. **Contrast Ratio**: Minimum 4.5:1 for normal text, 3:1 for large text
2. **Focus Indicators**: Always visible and high contrast
3. **Icon-Only Buttons**: Include aria-labels
4. **Color Independence**: Never rely solely on color to convey information

## Implementation Checklist

When updating a component:
- [ ] Replace white/light backgrounds with `bg-slate-800` or `bg-slate-700`
- [ ] Update all text to appropriate slate colors
- [ ] Add proper accent colors to icons
- [ ] Ensure borders use `border-slate-700` or accent colors
- [ ] Update hover states to use `hover:bg-slate-700`
- [ ] Check focus states use blue accent
- [ ] Verify badges use proper color scheme
- [ ] Test contrast ratios meet accessibility standards
- [ ] Ensure status indicators use standard colors
- [ ] Check that nested components maintain hierarchy
