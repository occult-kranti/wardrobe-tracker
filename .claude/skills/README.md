# Wardrobe Tracker - Skills

## wardrobe-closet-manager

Manage clothing items in the digital wardrobe.

### Actions

**add-item**
Add a clothing item to the wardrobe.
Parameters:
- name: string (item name)
- category: enum(tops, bottoms, dresses, outerwear, shoes, accessories)
- color: string
- image: string (base64 or URL)
- season: array of spring, summer, fall, winter
- occasion: array of casual, work, formal, sport, party

**list-items**
List all clothing items with optional filters.
Parameters:
- category: optional filter
- color: optional filter
- favorite: optional boolean

**update-item**
Update a clothing item's details.
Parameters:
- id: string
- Any fields to update

**delete-item**
Remove an item from the wardrobe.
Parameters:
- id: string

**get-stats**
Get wardrobe statistics.
Returns: total items, category breakdown, most worn, unworn items

## wardrobe-outfit-engine

Generate and manage outfits.

### Actions

**create-outfit**
Create an outfit from clothing items.
Parameters:
- name: string
- itemIds: array of item IDs
- occasion: optional

**suggest-outfit**
Get an outfit suggestion.
Parameters:
- occasion: optional
- weather: optional
- favorUnworn: boolean (default true)

**list-outfits**
List saved outfits.

**log-wear**
Log wearing an outfit or items.
Parameters:
- date: string (ISO date)
- outfitId: optional
- itemIds: array

## wardrobe-analytics

Analyze wardrobe usage and provide insights.

### Actions

**get-insights**
Get wardrobe insights.
Returns:
- Most worn items
- Least worn items
- Cost per wear (if cost data)
- Category gaps
- Seasonal usage

**get-calendar**
Get wear history for date range.
Parameters:
- startDate: string
- endDate: string

## wardrobe-design-consultant

Consult on wardrobe app design decisions.

### Actions

**suggest-colors**
Suggest color scheme adjustments.
Parameters:
- currentPalette: object
- mood: string
- targetAudience: string

**review-ui**
Review UI/UX decisions.
Parameters:
- screen: string
- elements: array
- userFlow: string

**psychology-check**
Check design against psychology principles.
Parameters:
- feature: string
- userAction: string
- potentialFriction: string

