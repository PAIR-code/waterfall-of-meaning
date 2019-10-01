### Waterfall of meaning

Visualization of word embedding meanings and bias exhibited at the Barbican center as part of the [AI: More than Human](https://www.barbican.org.uk/whats-on/2019/event/ai-more-than-human) exhibit


### From the exhibit description:
Language is subtle. Words may have multiple meanings and the same word can be used in different ways. This flexibility speaks to the richness of human language, full of associations and subtext.

Subconsciously, we consider certain words to be new or old, good or bad, male or female. When machines "read" text--from books, articles, letters--they start to learn how language is used and pick up on the multiple associations that may exist. For example: how are the words "caviar" and "pizza" used? Do they show up in the same contexts frequently? Are they used in the same way? Waterfall of Meaning uses technology called 'word embeddings' to analyse millions of existing English sentences and map words' meaning based on their use. When a word crosses an axis, its location shows where it falls on the spectrum - for instance, is "caviar" more male or female, based on this data?

To this end, any biases that are found in the data will be reflected in the model as well. For this reason, it's paramount to ensure that these models are not being used in ways that enforce existing biases, and to continue developing ways to de-bias these models.


Waterfall of Meaning is based on a technology in which a machine learning system analyzes millions of sentences to create a geometric "map" of word meanings. Such maps, known as "word embeddings," have become common in modern AI software. However, unlike a conventional map (which exists in two dimensions) or a globe (in three), the word embedding used in this piece exists in a space of hundreds of dimensions.

These dimensions help the machine represent some of the subtleties of language usage: in a sense, it's a way of transforming meaning into math. Certain directions in a word embedding map may reflect contrasts such as female vs. male, or good vs. bad. Understanding how these implicit dimensions form is currently a subject of great interest, both as a scientific question and as a type of transparency, helping us peer inside the black box of this type of AI. But we can also view the embedding a model of how humans have collectively used words, giving us a way to measure connotations quantitatively. In the end, this piece is not so much a portrait of a  machine but a picture of how humans speak.

### To run:


Install dependencies:

```
yarn
```

Watch the demo for changes with a local server:

```
yarn watch
```

Build the demo as a standalone page:

```
yarn build
```

Deploy the demo to GCP (you need gsutil and be logged in):

```
./deploy.sh
```

This is not an official Google product.
