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

// app.post('/save-preferences', (req, res) => {
//   const { name, brands, categories, patterns, ranks } = req.body;

//   const preferences = [
//     ...brands.map(brand => ({ _id: `${name}-${brand}`, user: name, preference: brand, type: 'brand' })),
//     ...categories.map(category => ({ _id: `${name}-${category}`, user: name, preference: category, type: 'category' })),
//     ...patterns.map(pattern => ({ _id: `${name}-${pattern}`, user: name, preference: pattern, type: 'pattern' })),
//     { _id: `${name}-ranks`, user: name, ranks: ranks, type: 'ranks' }
//   ];

//   userPrefDB.bulk({ docs: preferences }, (err, result) => {
//     if (err) {
//       console.error('Error saving preferences:', err);
//       res.status(500).send('Error saving preferences');
//     } else {
//       console.log('Preferences and ranks saved successfully:', name);
//       res.status(200).send('Preferences and ranks saved successfully');
//     }
//   });
// });

// app.get('/recommendations', (req, res) => {
//   const { name, gender } = req.query;

//   // Fetch user preferences
//   userPrefDB.find({ selector: { user: name } }, (err, userPrefs) => {
//     if (err) {
//       console.error('Error fetching user preferences:', err);
//       return res.status(500).send('Error fetching user preferences');
//     }

//     const userPreferences = userPrefs.docs.reduce((acc, pref) => {
//       acc[pref.type] = acc[pref.type] || [];
//       acc[pref.type].push(pref.preference);
//       return acc;
//     }, {});

//     const ranksDoc = userPrefs.docs.find(pref => pref.type === 'ranks');
//     const ranks = ranksDoc ? ranksDoc.ranks : {};
//     const rankPoints = { 1: 40, 2: 30, 3: 20, 4: 10 };

//     productsDB.list({ include_docs: true }, (err, products) => {
//       if (err) {
//         console.error('Error fetching products:', err);
//         return res.status(500).send('Error fetching products');
//       }

//       const recommendations = products.rows
//         .filter(row => row.doc.Gender === gender) // Filter by gender
//         .map(row => {
//           const product = row.doc;
//           let score = 0;

//           // Scoring logic
//           if (userPreferences.brand && userPreferences.brand.includes(product.Brand)) {
//             score += rankPoints[ranks.brand] || 0;
//           }
//           if (userPreferences.category && userPreferences.category.includes(product.Category)) {
//             score += rankPoints[ranks.category] || 0;
//           }
//           if (userPreferences.pattern && userPreferences.pattern.includes(product.Print_or_Pattern_Type)) {
//             score += rankPoints[ranks.pattern] || 0;
//           }
//           if (product.Original_Price <= userPreferences.price) {
//             score += rankPoints[ranks.price] || 0;
//           }

//           return { product, score };
//         })
//         .filter(item => item.score > 50) // Filter out products with a score of 70 or less

//       res.status(200).json(recommendations);
//     });
//   });
// });
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

app.get('/recommendations', (req, res) => {
  const { name, gender } = req.query;

  // Fetch user preferences and purchase history
  userPrefDB.find({ selector: { user: name } }, (err, userPrefs) => { 
    if (err) {
      console.error('Error fetching user preferences:', err);
      return res.status(500).send('Error fetching user preferences');
    }

    purchasesDB.find({ selector: { User: name } }, (err, purchases) => { //1
      if (err) {
        console.error('Error fetching purchase history:', err);
        return res.status(500).send('Error fetching purchase history');
      }

      const userPreferences = userPrefs.docs.reduce((acc, pref) => {
        acc[pref.type] = acc[pref.type] || [];
        acc[pref.type].push(pref.preference);
        return acc;
      }, {});

      const ranksDoc = userPrefs.docs.find(pref => pref.type === 'ranks');
      const ranks = ranksDoc ? ranksDoc.ranks : {};
      const rankPoints = { 1: 40, 2: 30, 3: 20, 4: 10 };

      const purchaseHistory = purchases.docs.reduce((acc, purchase) => {
        const product = purchase.product;
        acc.brands[product.Brand] = (acc.brands[product.Brand] || 0) + 1;
        acc.patterns[product.Print_or_Pattern_Type] = (acc.patterns[product.Print_or_Pattern_Type] || 0) + 1;
        acc.categories[product.Category] = (acc.categories[product.Category] || 0) + 1;
        acc.prices.push(product.Original_Price);
        return acc;
      }, { brands: {}, patterns: {}, categories: {}, prices: [] });

      const topBrands = Object.entries(purchaseHistory.brands).sort((a, b) => b[1] - a[1]).slice(0, 2).map(item => item[0]);
      const topPatterns = Object.entries(purchaseHistory.patterns).sort((a, b) => b[1] - a[1]).slice(0, 2).map(item => item[0]);
      const topCategories = Object.entries(purchaseHistory.categories).sort((a, b) => b[1] - a[1]).slice(0, 2).map(item => item[0]);
      const maxPrice = Math.max(...purchaseHistory.prices);

      const additionalPreferences = [
        ...topBrands.map(brand => ({ _id: `${name}-${brand}`, user: name, preference: brand, type: 'brand' })),
        ...topPatterns.map(pattern => ({ _id: `${name}-${pattern}`, user: name, preference: pattern, type: 'pattern' })),
        ...topCategories.map(category => ({ _id: `${name}-${category}`, user: name, preference: category, type: 'category' })),
        { _id: `${name}-price`, user: name, preference: maxPrice, type: 'price' }
      ];

      userPrefDB.bulk({ docs: additionalPreferences }, (err, result) => {
        if (err) {
          console.error('Error saving additional preferences:', err);
          return res.status(500).send('Error saving additional preferences');
        }

        productsDB.list({ include_docs: true }, (err, products) => {
          if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).send('Error fetching products');
          }

          const recommendations = products.rows
            .filter(row => row.doc.Gender === gender) // Filter by gender
            .map(row => {
              const product = row.doc;
              let score = 0;

              // Scoring logic
              if (userPreferences.brand && userPreferences.brand.includes(product.Brand)) {
                score += rankPoints[ranks.brand] || 0;
              }
              if (userPreferences.category && userPreferences.category.includes(product.Category)) {
                score += rankPoints[ranks.category] || 0;
              }
              if (userPreferences.pattern && userPreferences.pattern.includes(product.Print_or_Pattern_Type)) {
                score += rankPoints[ranks.pattern] || 0;
              }
              if (product.Original_Price <= userPreferences.price) {
                score += rankPoints[ranks.price] || 0;
              }

              return { product, score };
            })
            .filter(item => item.score > 50) // Filter out products with a score of 70 or less

          res.status(200).json(recommendations);
        });
      });
    });
  });
});



app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});