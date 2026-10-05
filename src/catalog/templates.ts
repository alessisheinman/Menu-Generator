import { slugify } from '../model/ids';
import type { MealTemplate, SaladBarConfig, Slot, TemplateLine, Venue } from '../model/types';

/** Reference dishes by their catalog name; the seed test checks every name exists. */
const d = (name: string, opts: Omit<TemplateLine, 'dishId'> & { alts?: string[] } = {}): TemplateLine => {
  const { alts, ...rest } = opts;
  return { dishId: slugify(name), ...rest, ...(alts ? { alternatives: alts.map(slugify) } : {}) };
};
const extra = (name: string, unit?: string): TemplateLine => d(name, { enabled: false, unit });
const slot = (s: Slot, name?: string, opts: { unit?: string; alts?: string[] } = {}): TemplateLine =>
  name ? d(name, { slot: s, ...opts }) : { dishId: null, slot: s };

export const SEED_SALAD_BAR: SaladBarConfig = {
  standard: ['Cherry Tomatoes', 'Cucumbers', 'Shredded Carrots', 'Beets', 'Garbanzo Beans', 'Broccoli', 'Croutons', 'Peas', 'Corn'],
  addOns: ['Tuna', 'Chicken Salad', 'Egg Salad', 'Salsa', 'Sour Cream', 'Jalapeños', 'Celery', 'Shredded Cheese'],
};

const BREAKFAST_EXTRAS = [
  extra('Fresh Fruits'), extra('Espresso'), extra('Juicer'), extra('Snacks'), extra('Hard Boiled Eggs'),
  extra('Fresh Fruit Tray', 'Large'),
];

export const SEED_TEMPLATES: MealTemplate[] = [
  {
    id: 'breakfast-standard', name: 'Standard Breakfast', mealType: 'Breakfast', includesSaladBar: false,
    lines: [
      d('Pastries', { unit: 'dz' }),
      d('Scrambled Organic Eggs'),
      d('“Just” Eggs Scrambled'),
      d('Crispy Bacon'),
      d('Local Sausage Patties', { alts: ['Local Sausage Links', 'Local Turkey Sausage Patties'] }),
      d('Breakfast Potatoes'),
      d('Blueberry Pancakes', { alts: ['French Toast', 'Buttermilk Pancakes with Warm Syrup'] }),
      d('Assorted Fresh Bagels', { unit: 'dz' }),
      d('Assorted Cream Cheese Selections', { unit: 'Small' }),
      d('Selection of Greek and Plain Yogurts', { unit: 'dz', alts: ['Plain Yogurts'] }),
      ...BREAKFAST_EXTRAS,
    ],
  },
  {
    id: 'breakfast-light', name: 'Light Breakfast (no hot items)', mealType: 'Breakfast', includesSaladBar: false,
    lines: [
      d('Pastries', { unit: 'dz' }),
      d('Assorted Fresh Bagels', { unit: 'dz' }),
      d('Assorted Cream Cheese Selections', { unit: 'Small' }),
      d('Selection of Greek and Plain Yogurts', { unit: 'dz' }),
      d('Hard Boiled Eggs'),
      ...BREAKFAST_EXTRAS.filter((l) => l.dishId !== slugify('Hard Boiled Eggs')),
    ],
  },
  {
    id: 'lunch-mediterranean', name: 'Mediterranean', mealType: 'Lunch', includesSaladBar: true,
    lines: [
      d('Moroccan Lentil Soup', { alts: ['Lentil Soup', 'Mulligatawny Soup', 'Chicken Soup with Vegetables'] }),
      d('Basmati Rice with Dill'),
      d('Chicken Kabob'),
      d('Kofta Kabob'),
      d('Falafel'),
      d('Organic Grilled Vegetables'),
      d('Fried Eggplants'),
      d('Mediterranean Salad', { unit: 'Medium' }),
      d('Hummus, Tahini, Yogurt with Dill', { unit: 'Small', alts: ['Hummus, Tahini, Tzatziki Spreads'] }),
      d('Fresh Pita'),
      d('Baklava'),
      d('Fresh Cookies'),
      extra('Chicken Soup with Vegetables'),
    ],
  },
  {
    id: 'lunch-italian', name: 'Italian', mealType: 'Lunch', includesSaladBar: true,
    lines: [
      d('Tuscan White Bean Soup', { alts: ['Tomato Cheddar Soup', 'Ten Vegetable Soup'] }),
      d('Penne al Pomodoro', { alts: ['Spaghetti Aglio e Olio', 'Fettuccine Alfredo'] }),
      d('Chicken Parm'),
      d('Eggplant Parm'),
      d('Creamy Mashed Potatoes', { alts: ['Mashed Potatoes', 'Baked Sweet Potatoes'] }),
      d('Sauteed Broccoli', { alts: ['Steamed Broccoli', 'Sauteed Broccoli with Garlic'] }),
      d('Fresh Cookies and Brownies', { alts: ['Fresh Blondies and Brownies'] }),
      extra('Meatballs Marinara'), extra('Black Bean Meatballs'), extra('Wild Rice with Vegetables and Tofu'),
      extra('BBQ Tofu'), extra('Deli and Cheese Tray', 'Small'),
    ],
  },
  {
    id: 'lunch-mexican', name: 'Mexican', mealType: 'Lunch', includesSaladBar: true,
    saladItems: ['Cherry Tomatoes', 'Cucumbers', 'Tuna', 'Chicken Salad', 'Egg Salad', 'Salsa', 'Sour Cream', 'Jalapeños', 'Celery', 'Shredded Cheese'],
    lines: [
      d('Ten Vegetable Soup'),
      d('Mexican Rice with Vegetables and Tofu'),
      d('Chicken Fajita'),
      d('Carnitas'),
      d('Beef Taco'),
      d('Beef Fajita'),
      d('Sweet Plantains'),
      d('Black Beans'),
      d('Tortillas'),
      d('Flan'),
      d('Tres Leches'),
    ],
  },
  {
    id: 'lunch-american', name: 'American (Burgers)', mealType: 'Lunch', includesSaladBar: true,
    lines: [
      d('Split Pea Soup', { alts: ['Tuscan White Bean Soup', 'Lentil Soup', 'Ten Vegetable Soup'] }),
      d('Grass-Fed Hamburgers'),
      d('Impossible Burgers', { alts: ['Black Bean Burgers'] }),
      d('5 Cheese Jalapeño Mac and Cheese', { alts: ['Five Cheese Mac and Cheese'] }),
      d('Sauteed Portobello Mushrooms'),
      d('Crispy Onions'),
      d('Home-Made Potato Chips'),
      d('Fresh Guacamole'),
      d('Cheese Toppers: Blue, Cheddar, Mozzarella, Swiss'),
      d('Fresh Deli and Sliced Cheeses Selections'),
      d('Homemade Albacore Tuna, Chicken, Home-style Potato & Egg Salad'),
      d('Fresh Baked Sandwich Rolls, Buns and Brioche'),
      d('Fresh Baked Blondies and Cookies', { alts: ['Fresh Blondies and Brownies', 'Fresh Cookies and Brownies'] }),
      d('Fresh Berries with Mint'),
      extra('Sliced Tomatoes, Onions and Pickles'), extra('Black Bean Burgers'),
    ],
  },
  {
    id: 'lunch-indian', name: 'Indian', mealType: 'Lunch', includesSaladBar: true,
    lines: [
      d('Chicken Tikka Masala'),
      d('Chana Masala'),
      d('Mild Coconut Curry Fish'),
      d('Basmati Rice'),
      d('Cumin-Roasted Cauliflower'),
      d('Mango Rice Pudding'),
      d('Cardamom-Spiced Fresh Fruit'),
    ],
  },
  {
    id: 'dinner-slots', name: 'Dinner (empty slots)', mealType: 'Dinner', includesSaladBar: false,
    lines: [
      slot('Starch'), slot('Starch'), slot('Protein'), slot('Protein'), slot('Vegetable'), slot('Vegetable'),
      slot('Dessert'), slot('Dessert'),
    ],
  },
  {
    id: 'dinner-comfort', name: 'Comfort Dinner', mealType: 'Dinner', includesSaladBar: false,
    lines: [
      slot('Starch', 'Vegetable Jambalaya'),
      slot('Starch', 'Rigatoni with Sausage and Peas'),
      slot('Protein', 'Roasted Rosemary Chicken', { unit: 'pcs' }),
      slot('Protein', 'Seared Teriyaki Salmon with Bok Choy', { unit: 'pcs' }),
      slot('Protein', 'Home Made Meatloaf with Gravy'),
      slot('Vegetable', 'Roasted Acorn Squash', { alts: ['Roasted Butternut Squash', 'Collard Greens'] }),
      slot('Vegetable', 'Creamy Mashed Potatoes'),
      slot('Dessert', 'Belgian Chocolate Cake'),
      slot('Dessert', 'Limoncello Cake'),
      slot('Dessert', 'Apple Pie'),
      d('Fresh Fruit Tray', { unit: 'Large' }),
      extra('French Macarons'), extra('Berry Trifle'),
    ],
  },
  {
    id: 'dinner-light', name: 'Light Dinner', mealType: 'Dinner', includesSaladBar: false,
    lines: [
      slot('Starch', 'Vegetable Jambalaya'),
      slot('Starch', 'Penne al Pomodoro'),
      slot('Protein', 'Grilled Chicken Paillard with Tomatoes and Arugula'),
      slot('Protein', 'Organic Seared Wild King Salmon with Spinach', { alts: ['Seared Salmon with Spinach'] }),
      slot('Protein', 'Seared Skirt Steak with Rosemary'),
      slot('Vegetable', 'Roasted Acorn Squash'),
      slot('Vegetable', 'Grilled Organic Asparagus and Broccolini'),
      slot('Dessert', 'French Macarons'),
      slot('Dessert', 'Belgian Chocolate Cake'),
      slot('Dessert', 'Berry Trifle'),
      extra('Cheesecake'), extra('Fresh Fruit Tray', 'Large'),
    ],
  },
];

export const SEED_VENUES: Venue[] = [
  { id: 'rcmh', name: 'Radio City Music Hall', printLabel: 'RCMH' },
  { id: 'barclays', name: 'Barclays Center', printLabel: 'Barclays Center' },
  { id: 'prucenter', name: 'Prudential Center', printLabel: 'PruCenter' },
  { id: 'pier17', name: 'Pier 17', printLabel: 'Pier 17' },
  { id: 'hulu', name: 'Hulu Theater', printLabel: 'HULU' },
  { id: 'infosys', name: 'InfoSys Theatre', printLabel: 'InfoSys Theatre' },
];
