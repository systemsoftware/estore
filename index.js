const express = require('express');
const { port, stripe_api_key, currency, cancel_url, success_url, payment_method_types, title } = require('./config.json');
const { writeFileSync, readFileSync } = require('fs');
const products = require('./products.json')

const app = express();
const stripe = new (require('stripe')).Stripe(stripe_api_key)

if(!port) throw new Error('Port not specified in config.json');
if(!stripe_api_key) throw new Error('Stripe API key not specified in config.json');
if(!currency) throw new Error('Currency not specified in config.json');
if(!cancel_url) throw new Error('Cancel URL not specified in config.json');
if(!success_url) throw new Error('Success URL not specified in config.json');
if(!payment_method_types) throw new Error('Payment method types not specified in config.json');
if(!title) throw new Error('Title not specified in config.json');
if(products.length < 1) throw new Error('No products specified in products.json');
if(products.find(product => product.name.includes('|'))) throw new Error('Product name cannot contain "|"');

app.get('/buy/:name', async (req, res) => {
    try{
    if(!req.params.name) return res.send('Invalid request');
    const products = JSON.parse(readFileSync('./products.json', 'utf8'));
    const line_items = []
    req.params.name.split('|').forEach(_product => {
        const name = _product.split('-')[0]
        const quantity = _product.split('-')[1] || 1
        const product = products.find(product => product.name.toLowerCase() == name.toLowerCase())
        if(!product) return res.send('Invalid product');
        if(product.stock && quantity > product.stock) return res.send('Out of stock');
        if(quantity < 1) return res.send('Invalid quantity')
        if(quantity > product.max_quantity) return res.send(`Max quantity is ${product.max_quantity}`)
        if(quantity < product.min_quantity) return res.send(`Minimum quantity is ${product.min_quantity}`)
        line_items.push({
            price_data: {
                currency,
                product_data: {
                    name: name.substring(0, 1).toUpperCase() + product.name.substring(1),
                },
                unit_amount: product.price * 100,
            },
            quantity
        })
    })
    const session = await stripe.checkout.sessions.create({
        payment_method_types,
        line_items,
        mode: 'payment',
        success_url: `http://${req.hostname}/success/${encodeURIComponent(req.params.name)}/?id={CHECKOUT_SESSION_ID}`,
        cancel_url,
    });

    res.redirect(303, session.url);
}catch (err) {
console.log(err)
try{
res.send(err.message)
}catch{}
}
})

app.get('/success/:name', (req, res) => {
decodeURIComponent(req.params.name).split('|').forEach(async _name => {
const name = _name.split('-')[0]
const quantity = _name.split('-')[1] || 1
const products = require('./products.json')
const product = products.find(product => product.name.toLowerCase() == name.toLowerCase())
if((await stripe.checkout.sessions.retrieve(req.query.id)).payment_status != 'paid') return res.send('Payment failed')
if(product.stock) product.stock -= quantity
writeFileSync('./products.json', JSON.stringify(products, null, 4))
})
res.redirect(success_url)
})

app.get('/products', (req, res) => {
    res.sendFile(`${__dirname}/products.json`)
})

app.get('/style', (req, res) => {
    res.sendFile(`${__dirname}/style.css`)
})

app.get('/title', (req, res) => {
res.send(title)
})

app.get('/checkout', (req, res) => {
res.sendFile(`${__dirname}/c.html`)
})

app.get('/canceled', (req, res) => {
    res.sendFile(`${__dirname}/canceled.html`)
    })
    
    app.get('/success', (req, res) => {
        res.sendFile(`${__dirname}/success.html`)
        })

app.get('/*', (req, res) => {
if(!req.accepts('html')) return
res.sendFile(`${__dirname}/index.html`)
})


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
})