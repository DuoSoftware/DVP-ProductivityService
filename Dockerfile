#FROM ubuntu
#RUN apt-get update
#RUN apt-get install -y git nodejs npm
#RUN git clone git://github.com/DuoSoftware/DVP-ProductivityService.git /usr/local/src/productivityservice
#RUN cd /usr/local/src/productivityservice; npm install
#CMD ["nodejs", "/usr/local/src/productivityservice/app.js"]

#EXPOSE 8876

FROM node:5.10.0
ARG VERSION_TAG
RUN git clone -b $VERSION_TAG https://github.com/DuoSoftware/DVP-ProductivityService.git /usr/local/src/productivityservice
RUN cd /usr/local/src/productivityservice; npm install
WORKDIR /usr/local/src/productivityservice
RUN npm install
EXPOSE 8876
CMD [ "node", "/usr/local/src/productivityservice/app.js" ]
