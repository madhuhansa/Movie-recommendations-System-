$(document).ready(function() {
    // Initialize with placeholder
    showSelectionPlaceholder();
    
    // Load posters for random movies
    loadPosters('#random-movies');
    
    // Movie selection
    $(document).on('click', '.select-movie', function() {
        const card = $(this).closest('.movie-card');
        const title = card.data('title');
        
        if ($('#selected-movies').find(`[data-title="${title}"]`).length === 0) {
            const clone = card.clone();
            clone.find('.poster-overlay').html(`
                <button class="btn btn-danger btn-sm remove-movie" title="Remove">
                    ❌ 
                </button>
            `);
            
            // Create a new column wrapper for the cloned card
            const col = $('<div class="col"></div>').append(clone);
            $('#selected-movies').append(col);
            
            hideSelectionPlaceholder();
        }
    });

    // Movie removal - Modified to properly handle layout
    $(document).on('click', '.remove-movie', function() {
        $(this).closest('.col').remove();
        
        // Check if no movies left to show placeholder
        if ($('#selected-movies .col').length === 0) {
            showSelectionPlaceholder();
        }
    });
    
    // Get recommendations
    $('#get-recommendations').click(function() {
        const selected = $('#selected-movies .movie-card').map(function() {
            return $(this).data('title');
        }).get();
        
        if (selected.length === 0) {
            alert('Please select at least one movie');
            return;
        }
        
        $.ajax({
            url: '/recommend',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ movies: selected }),
            success: function(recommendations) {
                $('#recommendations').empty();
                recommendations.forEach(movie => {
                    if (movie.poster) {
                        $('#recommendations').append(`
                            <div class="col-5 col-md-5 mb-3">
                                <div class="movie-card card h-100">
                                    <img src="${movie.poster}" class="card-img-top" alt="${movie.title}">
                                    <div class="card-body">
                                        <h5 class="card-title">${movie.title}</h5>
                                    </div>
                                </div>
                            </div>
                        `);
                    }
                });
            }
        });
    });
    
    // Refresh random movies
    $('#refresh-movies').click(function() {
        $.get('/', function(data) {
            const newDoc = new DOMParser().parseFromString(data, 'text/html');
            const newMovies = $(newDoc).find('#random-movies').html();
            $('#random-movies').html(newMovies);
            loadPosters('#random-movies');
        });
    });
    
    // Movie Search Functionality
    $('#movie-search').on('keypress', function(e) {
        if (e.which === 13) { // Enter key
            const query = $(this).val().trim();
            if (query.length > 2) {
                searchMovies(query);
            } else {
                alert('Please enter at least 3 characters');
            }
        }
    });
    
    $('.input-group-text').on('click', function() {
        const query = $('#movie-search').val().trim();
        if (query.length > 2) {
            searchMovies(query);
        } else {
            alert('Please enter at least 3 characters');
        }
    });
    
    function searchMovies(query) {
        $.ajax({
            url: '/search_movies',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ query: query }),
            success: function(response) {
                displaySearchResults(response.results);
            },
            error: function() {
                alert('Error searching for movies');
            }
        });
    }
    
    function displaySearchResults(movies) {
        const $container = $('#search-results');
        const $resultsContainer = $('#search-results-container');
        
        $container.empty();
        
        if (movies.length === 0) {
            $container.html('<div class="col-12 no-results"><i class="fas fa-film me-2"></i>No movies found matching your search</div>');
        } else {
            movies.slice(0, 5).forEach(movie => {
                $container.append(`
                    <div class="col">
                        <div class="movie-card card h-100 search-movie-card" data-title="${movie}">
                            <div class="poster-container">
                                <img src="" class="card-img-top movie-poster" alt="${movie}">
                                <div class="poster-overlay">
                                    <button class="btn btn-primary btn-sm select-movie">
                                        <i class="fas fa-plus"></i> Select
                                    </button>
                                </div>
                            </div>
                            <div class="card-body p-2">
                                <h6 class="card-title text-truncate">${movie}</h6>
                            </div>
                        </div>
                    </div>
                `);
                
                // Load poster for this movie
                loadMoviePoster(movie, $(`.search-movie-card[data-title="${movie}"] .movie-poster`));
            });
        }
        
        $resultsContainer.show();
    }
    
    // Helper function to load posters
    function loadPosters(container) {
        $(container).find('.movie-card').each(function() {
            const card = $(this);
            const title = card.data('title');
            loadMoviePoster(title, card.find('.movie-poster'));
        });
    }
    
    function loadMoviePoster(movieTitle, $imgElement) {
        $.get('/get-poster?title=' + encodeURIComponent(movieTitle), function(posterUrl) {
            if (posterUrl) {
                $imgElement.attr('src', posterUrl);
            } else {
                $imgElement.attr('src', 'https://via.placeholder.com/200x300?text=' + encodeURIComponent(movieTitle));
            }
        }).fail(function() {
            $imgElement.attr('src', 'https://via.placeholder.com/200x300?text=' + encodeURIComponent(movieTitle));
        });
    }
    
    // Helper functions for selection placeholder
    function showSelectionPlaceholder() {
        if ($('#selected-movies .empty-selection').length === 0) {
            $('#selected-movies').html(`
                <div class="col-12 text-center py-5 empty-selection">
                    <i class="fas fa-heart fa-3x text-muted mb-3"></i>
                    <p class="text-muted">Select movies to add them to your selection</p>
                </div>
            `);
        }
    }
    
    function hideSelectionPlaceholder() {
        $('#selected-movies .empty-selection').remove();
    }

    // Handle year range slider
    const yearRange = document.getElementById('year-range');
    const yearDisplay = document.getElementById('year-display');
    
    if (yearRange) {
        const [minYear, maxYear] = yearRange.value.split(',').map(Number);
        yearDisplay.textContent = `${minYear} - ${maxYear}`;
        
        yearRange.addEventListener('input', function() {
            const [min, max] = this.value.split(',').map(Number);
            yearDisplay.textContent = `${min} - ${max}`;
        });
    }
    
    // Handle filter application
    $('#apply-filters').on('click', applyFilters);
    
    function applyFilters() {
        const filters = {
            genres: [],
            year_range: null,
            min_rating: 0
        };
        
        // Get selected genres
        $('input[name="genres"]:checked').each(function() {
            filters.genres.push($(this).val());
        });
        
        // Get year range
        if (yearRange) {
            const [minYear, maxYear] = yearRange.value.split(',').map(Number);
            filters.year_range = [minYear, maxYear];
        }
        
        // Get minimum rating
        const minRatingSelect = $('#min-rating').val();
        if (minRatingSelect) {
            filters.min_rating = parseFloat(minRatingSelect);
        }
        
        // Send request to server
        $.ajax({
            url: '/filter-movies',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ filters }),
            success: function(data) {
                if (data.error) {
                    alert(data.error);
                    return;
                }
                
                displayFilteredMovies(data.movies);
                $('#filter-results-count').text(`Showing ${data.movies.length} of ${data.total_results} movies`);
            },
            error: function() {
                alert('An error occurred while filtering movies');
            }
        });
    }
    
    function displayFilteredMovies(movies) {
        const $container = $('#filtered-movies-container');
        $container.empty();
        
        if (movies.length === 0) {
            $container.html('<p>No movies match your filters.</p>');
            return;
        }
        
        movies.forEach(movie => {
            $container.append(`
                <div class="col">
                    <div class="movie-card card h-100">
                        <img src="${movie.poster || 'https://via.placeholder.com/180x270?text=No+Poster'}" 
                             class="card-img-top" alt="${movie.title}">
                        <div class="card-body">
                            <h5 class="card-title">${movie.title}</h5>
                            <p class="card-text">${movie.year || 'N/A'} • Rating: ${movie.rating || 'N/A'}</p>
                            <button class="btn btn-primary btn-sm select-movie">
                                <i class="fas fa-plus"></i> Select
                            </button>
                        </div>
                    </div>
                </div>
            `);
        });
    }
});