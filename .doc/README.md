Prompt chagpt + zip projet base44 :
migre le projet actuellement sur plateforme base44 en docker GCP.
Supprime toutes dependances avec base44 afin d'etre autonome.
Met les bases de données sur bucket GCP dbase-public.
Garde exactement le meme UX.
Donne moi le zip du projet et du docker.
Verifie de bien intégrer dans le docker toutes le librairie nécessaire.


docker system prune -a -f
docker build -f Dockerfile -t pulse:latest .
docker tag pulse:latest eu.gcr.io/euveka-438213/pulse:latest
docker push eu.gcr.io/euveka-438213/pulse:latest
gcloud run deploy pulse --image eu.gcr.io/euveka-438213/pulse:latest --allow-unauthenticated --region europe-west2 --platform managed
Service [portefolio] revision [portefolio-00001-t67] has been deployed and is serving 100 percent of traffic.
Service URL: https://portefolio-37505828691.europe-west2.run.app