import spotipy
import spotipy.util as util

client_id = "7a13cdb69a5f4d0e93a302a155e81473";

client_secret = "4b44513b49424bda82cbfcc25f42835f";
redirect_uri = "http://localhost:8080/callback";

scope = 'user-library-read'
username = 'spotyelo' 

token = util.prompt_for_user_token(username,
                                   scope,
                                   client_id=client_id,
                                   client_secret=client_secret,
                                   redirect_uri=redirect_uri)
print(token)
