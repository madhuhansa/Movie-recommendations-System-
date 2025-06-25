def custom_tokenizer(x):
    return x.split(', ')

from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import joblib
import requests
import random
from sklearn.metrics.pairwise import cosine_similarity
import scipy.sparse
from fuzzywuzzy import fuzz

app = Flask(__name__)

# Load components (using lazy loading pattern)
def get_components():
    if not hasattr(app, 'components'):
        app.components = {
            'count_vectorizer': joblib.load('models/count_vectorizer.pkl'),
            'lang_encoder': joblib.load('models/lang_encoder.pkl'),
            'scaler': joblib.load('models/minmax_scaler.pkl'),
            'vectors': np.load('models/overview_vectors.npy'),
            'final_matrix': scipy.sparse.load_npz('models/final_matrix.npz').tocsr(),
            'df': pd.read_csv('models/movies_df.csv')
        }
    return app.components

def fetch_poster(movie_id):
    url = f"https://api.themoviedb.org/3/movie/{movie_id}?api_key=c7ec19ffdd3279641fb606d19ceb9bb1&language=en-US"
    data = requests.get(url).json()
    poster_path = data.get('poster_path')
    return f"https://image.tmdb.org/t/p/w500/{poster_path}" if poster_path else None

@app.route('/get-poster')
def get_poster():
    title = request.args.get('title')
    df = get_components()['df']
    movie = df[df['title'] == title].iloc[0]
    poster_url = fetch_poster(movie['id'])
    return jsonify(poster_url)

@app.route('/')
def home():
    components = get_components()
    random_movies = random.sample(list(components['df']['title']), 10)
    return render_template('index.html', random_movies=random_movies)

# New search endpoint
@app.route('/search_movies', methods=['POST'])
def search_movies():
    query = request.json.get('query', '').lower().strip()
    if len(query) < 3:
        return jsonify({"error": "Query too short"}), 400
    
    df = get_components()['df']
    
    # First try exact matches
    exact_matches = df[df['title'].str.lower().str.contains(query)]
    
    # Then try fuzzy matching if not enough results
    if len(exact_matches) < 5:
        df['match_score'] = df['title'].apply(lambda x: fuzz.partial_ratio(x.lower(), query))
        fuzzy_matches = df[df['match_score'] >= 70].sort_values('match_score', ascending=False)
        results = fuzzy_matches.head(5)['title'].tolist()
    else:
        results = exact_matches.head(5)['title'].tolist()
    
    return jsonify({"results": results})

# Keep all your existing routes below exactly as they are
@app.route('/recommend', methods=['POST'])
def recommend():
    components = get_components()
    selected_titles = request.json.get('movies', [])
    
    if not selected_titles:
        return jsonify({"error": "No movies selected"}), 400

    df = components['df']
    final_matrix = components['final_matrix']
    
    try:
        input_titles = [title.lower() for title in selected_titles]
        movie_index = pd.Series(df.index, index=df['title'].str.lower())

        selected_indexes = [movie_index[title] for title in input_titles if title in movie_index]
        if len(selected_indexes) < 1:
            return jsonify({"error": "No valid movies found"}), 400

        selected_vectors = final_matrix[selected_indexes]
        avg_vector = np.asarray(selected_vectors.mean(axis=0))
        similarities = cosine_similarity(avg_vector.reshape(1, -1), final_matrix).flatten()
        
        similar_indices = similarities.argsort()[::-1]
        recommended_indices = [i for i in similar_indices if i not in selected_indexes][:5]
        
        recommendations = []
        for idx in recommended_indices:
            movie = df.iloc[idx]
            recommendations.append({
                "title": str(movie['title']),
                "poster": fetch_poster(int(movie['id'])),
                "id": int(movie['id'])
            })
        
        return jsonify(recommendations)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)