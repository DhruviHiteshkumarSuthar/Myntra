const express = require('express');
const bodyParser = require('body-parser');
const Cloudant = require('@cloudant/cloudant');

const app = express();
const PORT = process.env.PORT || 8000;
const url = "https://apikey-v2-2e5kdlgplmovp6jb5xfuok6afjra827zegiyhiw2ul1u:d32ec5f34b80eec562777356d8d80d1b@b9884815-a388-4e5e-8d1d-784e73de0044-bluemix.cloudantnosqldb.appdomain.cloud";
const username = "apikey-v2-2e5kdlgplmovp6jb5xfuok6afjra827zegiyhiw2ul1u";
const password = "d32ec5f34b80eec562777356d8d80d1b";

const cloudant = Cloudant({ url: url, username: username, password: password });
const usersDB = cloudant.use('myntra_users');
const userPrefDB = cloudant.use('user_preferences');
const productsDB = cloudant.use('products');
const purchasesDB = cloudant.use('purchase_history'); 

app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

app.post('/signup', (req, res) => {
  const { name, email, upassword } = req.body;

  usersDB.get(name, (err, body) => {
    if (!err && body) {
      // Name already exists
      console.log('Name already exists:', name);
      res.status(400).send('Name already exists');
    } else if (err && err.statusCode === 404) {
      // Name does not exist, create new user
      const newUser = { _id: name, email: email, upassword: upassword };
      usersDB.insert(newUser, (err, result) => {
        if (err) {
          console.error('Error creating user:', err);
          res.status(500).send('Error creating user');
        } else {
          console.log('User created successfully:', name);
          res.redirect(`/preferences.html?name=${name}`);
        }
      });
    } else {
      console.error('Error getting user:', err);
      res.status(500).send('Error checking existing user');
    }
  });
});

app.post('/signin', (req, res) => {
  const { name, upassword } = req.body;

  usersDB.get(name, (err, body) => {
    if (!err && body) {
      if (body.upassword === upassword) {
        console.log('Sign in successful:', name);
        res.redirect(`/home.html?name=${name}`);
      } else {
        console.log('Invalid password:', name);
        res.status(400).send('Invalid name or password');
      }
    } else if (err && err.statusCode === 404) {
      // User not found
      console.error('User not found:', name);
      res.status(400).send('User not found');
    } else {
      console.error('Error getting user:', err);
      res.status(500).send('Error checking user');
    }
  });
});

app.post('/save-preferences', (req, res) => {
  const { name, brands, categories, patterns, ranks } = req.body;

  const preferences = [
    ...brands.map(brand => ({ _id: `${name}-${brand}`, user: name, preference: brand, type: 'brand' })),
    ...categories.map(category => ({ _id: `${name}-${category}`, user: name, preference: category, type: 'category' })),
    ...patterns.map(pattern => ({ _id: `${name}-${pattern}`, user: name, preference: pattern, type: 'pattern' })),
    { _id: `${name}-ranks`, user: name, ranks: ranks, type: 'ranks' }
  ];

  userPrefDB.bulk({ docs: preferences }, (err, result) => {
    if (err) {
      console.error('Error saving preferences:', err);
      res.status(500).send('Error saving preferences');
    } else {
      console.log('Preferences and ranks saved successfully:', name);
      res.status(200).send('Preferences and ranks saved successfully');
    }
  });
});

const rankPoints = { 1: 40, 2: 30, 3: 20, 4: 10 };

app.get('/recommendations', (req, res) => {
  const { name, gender } = req.query;

  // Fetch user preferences
  userPrefDB.find({ selector: { user: name } }, (err, userPrefs) => {
    if (err) {
      console.error('Error fetching user preferences:', err);
      return res.status(500).send('Error fetching user preferences');
    }

    const ranksDoc = userPrefs.docs.find(pref => pref.type === 'ranks');
    const ranks = ranksDoc ? ranksDoc.ranks : {};

    // Fetch purchase history
    purchasesDB.find({ selector: { user: name } }, (err, purchases) => {
      if (err) {
        console.error('Error fetching purchase history:', err);
        return res.status(500).send('Error fetching purchase history');
      }


      const purchaseHistory = purchases.docs.reduce((acc, purchase) => {
        acc.brands[purchase.Brand] = (acc.brands[purchase.Brand] || 0) + 1;
        acc.patterns[purchase.Print_or_Pattern_Type] = (acc.patterns[purchase.Print_or_Pattern_Type] || 0) + 1;
        acc.categories[purchase.Category] = (acc.categories[purchase.Category] || 0) + 1;
        acc.prices.push(purchase.Original_Price);
        return acc;
      }, { brands: {}, patterns: {}, categories: {}, prices: [] });


      // Extract additional preferences from purchase history
      const topBrands = Object.entries(purchaseHistory.brands).sort((a, b) => b[1] - a[1]).slice(0, 2).map(item => item[0]);
      const topPatterns = Object.entries(purchaseHistory.patterns).sort((a, b) => b[1] - a[1]).slice(0, 2).map(item => item[0]);
      const topCategories = Object.entries(purchaseHistory.categories).sort((a, b) => b[1] - a[1]).slice(0, 2).map(item => item[0]);
      const maxPrice = purchaseHistory.prices.length > 0 ? Math.max(...purchaseHistory.prices) : null;


      const additionalPreferences = [
        ...topBrands.map(brand => ({ _id: `${name}-${brand}`, user: name, preference: brand, type: 'brand' })),
        ...topPatterns.map(pattern => ({ _id: `${name}-${pattern}`, user: name, preference: pattern, type: 'pattern' })),
        ...topCategories.map(category => ({ _id: `${name}-${category}`, user: name, preference: category, type: 'category' })),
        { _id: `${name}-price`, user: name, preference: maxPrice, type: 'price' }
      ];


      // Filter out preferences that already exist
      const existingPreferences = new Set(userPrefs.docs.map(pref => pref._id));
      const newPreferences = additionalPreferences.filter(pref => !existingPreferences.has(pref._id));

      // Save new preferences to userPrefDB
      if (newPreferences.length > 0) {
        userPrefDB.bulk({ docs: newPreferences }, (err, result) => {
          if (err) {
            console.error('Error saving new preferences:', err);
            return res.status(500).send('Error saving new preferences');
          }

          console.log('New preferences saved:', result);
        });
      } else {
        console.log('No new preferences to save.');
      }

      // Fetch products and calculate recommendations
      productsDB.list({ include_docs: true }, (err, products) => {
        if (err) {
          console.error('Error fetching products:', err);
          return res.status(500).send('Error fetching products');
        }

        const recommendations = products.rows
          .filter(row => row.doc.Gender.toLowerCase() === gender.toLowerCase())
          .map(row => {
            const product = row.doc;
            let score = 0;

            // Scoring logic with debugging
            const brandMatch = userPrefs.docs.find(pref => pref.type === 'brand' && pref.preference === product.Brand);
            const categoryMatch = userPrefs.docs.find(pref => pref.type === 'category' && pref.preference === product.Category);
            const patternMatch = userPrefs.docs.find(pref => pref.type === 'pattern' && pref.preference === product.Print_or_Pattern_Type);
            const priceMatch = userPrefs.docs.find(pref => pref.type === 'price')?.preference;

            if (brandMatch) {
              score += rankPoints[ranks.brand] || 0;
            }
            if (categoryMatch) {
              score += rankPoints[ranks.category] || 0;
            }
            if (patternMatch) {
              score += rankPoints[ranks.pattern] || 0;
            }
            if (typeof priceMatch === 'number' && product.Original_Price <= priceMatch) {
              score += rankPoints[ranks.price] || 0;
            }

            return { product, score };
          });


        const filteredRecommendations = recommendations.filter(item => item.score >= 60); // Filter out products with a score less than or equal to 60


        res.status(200).json(filteredRecommendations);
      });
    });
  });
});


const colorCombinations = {
  'Blue': ['Orange', 'White', 'Grey', 'Beige'],
  'Red': ['White', 'Black'],
  'Yellow': ['Purple', 'Brown', 'Black'],
  'Green': ['Yellow', 'Brown', 'Beige'],
  'Orange': ['Blue', 'White', 'Black'],
  'Purple': ['Yellow', 'White', 'Grey'],
  'Pink': ['Grey', 'White', 'Black'],
  'Black': ['White', 'Grey', 'Red'],
  'White': ['Black', 'Blue', 'Red'],
  'Grey': ['Pink', 'Blue', 'White'],
  'Brown': ['Yellow', 'Green', 'Beige'],
  'Beige': ['Brown', 'Blue', 'White'],
  'Magenta': ['White', 'Black', 'Grey'],
  'Burgundy': ['Grey', 'White', 'Black'],
  'Lavender': ['Beige', 'White', 'Grey'],
  'Peach': ['Cream', 'White', 'Grey'],
  'Cream': ['Peach', 'Brown', 'White'],
  'Khakhi': ['Blue', 'White', 'Black'],
  'Multicoloured': ['Blue', 'White', 'Black'],
  'Maroon': ['White', 'Black', 'Beige', 'Grey', 'Peach'],
  'Violet': ['White', 'Grey', 'Cream', 'Beige']
};

app.get('/outfit-recommendations', (req, res) => {
  const { occasion, gender } = req.query;

  productsDB.list({ include_docs: true }, (err, products) => {
    if (err) {
      console.error('Error fetching products:', err);
      return res.status(500).send('Error fetching products');
    }

    const topWearCategories = ['T-Shirts', 'Shirts', 'Tops', 'Blazers', 'Jackets'];
    const bottomWearCategories = ['Trousers', 'Jeans', 'Track-Pants', 'Shorts'];

    // Filter tops and bottoms by occasion and gender
    const tops = products.rows.filter(row =>
      topWearCategories.includes(row.doc.Individual_Category) &&
      row.doc.Occasion === occasion &&
      row.doc.Gender.toLowerCase() === gender.toLowerCase()
    ).map(row => row.doc);

    const bottoms = products.rows.filter(row =>
      bottomWearCategories.includes(row.doc.Individual_Category) &&
      row.doc.Occasion === occasion &&
      row.doc.Gender.toLowerCase() === gender.toLowerCase()
    ).map(row => row.doc);

    // Generate outfit combinations
    const outfitRecommendations = [];

    tops.forEach(top => {
      bottoms.forEach(bottom => {
        if (colorCombinations[top.Color]?.includes(bottom.Color)) {
          outfitRecommendations.push({
            top: { Product_id: top.Product_id, Product: top.Product, Color: top.Color },
            bottom: { Product_id: bottom.Product_id, Product: bottom.Product, Color: bottom.Color },
          });
        }
      });
    });

    // Shuffle and limit recommendations
    const shuffledRecommendations = outfitRecommendations.sort(() => 0.5 - Math.random()).slice(0, 6);
    res.status(200).json(shuffledRecommendations);
  });
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});