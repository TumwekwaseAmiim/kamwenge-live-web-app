import { auth } from './firebase-core.js';

import {
  livekitConfig,
  livekitConfigured
} from './media-config.js';

import {
  Room,
  RoomEvent,
  Track
} from 'https://cdn.jsdelivr.net/npm/livekit-client@2.15.6/+esm';


let publisherRoom = null;
let publisherTracks = [];

let viewerRoom = null;
let viewerVideoTrack = null;
let viewerAudioTracks = [];


// =====================================================
// TOKEN REQUEST
// =====================================================

async function requestToken(eventId, role) {

  if (!livekitConfigured) {
    throw new Error(
      'Live video is not configured yet.'
    );
  }

  if (!eventId) {
    throw new Error(
      'Event ID is required for live streaming.'
    );
  }

  const headers = {
    'Content-Type': 'application/json'
  };


  if (role === 'publisher') {

    const user = auth?.currentUser;

    if (!user) {
      throw new Error(
        'Broadcaster authentication is required.'
      );
    }

    const idToken =
      await user.getIdToken();

    headers.Authorization =
      `Bearer ${idToken}`;
  }


  const response =
    await fetch(
      livekitConfig.tokenEndpoint,
      {
        method: 'POST',
        headers,

        body: JSON.stringify({
          eventId,
          role
        })
      }
    );


  const data =
    await response
      .json()
      .catch(() => ({}));


  if (!response.ok) {
    throw new Error(
      data?.error ||
      'Could not create a live streaming session.'
    );
  }


  if (
    !data.token ||
    !data.wsUrl
  ) {
    throw new Error(
      'Streaming server returned an incomplete session.'
    );
  }


  return data;
}


// =====================================================
// BROADCASTER
// =====================================================

export async function publishStream(
  eventId,
  mediaStream
) {

  if (
    !mediaStream ||
    !mediaStream.getTracks().length
  ) {
    throw new Error(
      'No camera or screen stream is active.'
    );
  }


  await stopPublish();


  const session =
    await requestToken(
      eventId,
      'publisher'
    );


  const room =
    new Room({

      /*
       * IMPORTANT:
       * Disable adaptive behaviour during testing.
       * We want the main video to continue transmitting
       * continuously without LiveKit deciding to pause it.
       */

      adaptiveStream: false,
      dynacast: false
    });


  // =====================================================
  // PUBLISHER CONNECTION EVENTS
  // =====================================================

  room.on(
    RoomEvent.Connected,
    () => {
      console.log(
        'Kamwenge Live broadcaster connected:',
        eventId
      );
    }
  );


  room.on(
    RoomEvent.Reconnecting,
    () => {
      console.log(
        'Kamwenge Live broadcaster reconnecting...'
      );
    }
  );


  room.on(
    RoomEvent.Reconnected,
    () => {
      console.log(
        'Kamwenge Live broadcaster reconnected.'
      );
    }
  );


  room.on(
    RoomEvent.Disconnected,
    () => {
      console.log(
        'Kamwenge Live broadcaster disconnected.'
      );
    }
  );


  // =====================================================
  // CONNECT PUBLISHER
  // =====================================================

  await room.connect(
    session.wsUrl,
    session.token
  );


  publisherRoom = room;
  publisherTracks = [];


  // =====================================================
  // VIDEO
  // =====================================================

  const videoTracks =
    mediaStream
      .getVideoTracks()
      .filter(
        track =>
          track.readyState === 'live'
      );


  for (const videoTrack of videoTracks) {

    console.log(
      'Publishing Kamwenge Live video:',
      videoTrack.label,
      videoTrack.readyState
    );


    await room
      .localParticipant
      .publishTrack(
        videoTrack,
        {
          name: 'main-video',
          source: Track.Source.Camera
        }
      );


    publisherTracks.push(
      videoTrack
    );
  }


  // =====================================================
  // AUDIO
  // =====================================================

  const audioTracks =
    mediaStream
      .getAudioTracks()
      .filter(
        track =>
          track.readyState === 'live'
      );


  for (const audioTrack of audioTracks) {

    console.log(
      'Publishing Kamwenge Live audio:',
      audioTrack.label,
      audioTrack.readyState
    );


    await room
      .localParticipant
      .publishTrack(
        audioTrack,
        {
          name: 'main-audio',
          source:
            Track.Source.Microphone
        }
      );


    publisherTracks.push(
      audioTrack
    );
  }


  console.log(
    'Kamwenge Live publishing started.',
    {
      eventId,
      videoTracks:
        videoTracks.length,
      audioTracks:
        audioTracks.length
    }
  );


  return {
    room
  };
}


// =====================================================
// SWITCH CAMERA / SCREEN
// =====================================================

export async function replacePublishedStream(
  eventId,
  mediaStream
) {

  console.log(
    'Changing Kamwenge Live broadcast source...'
  );


  return publishStream(
    eventId,
    mediaStream
  );
}


// =====================================================
// STOP PUBLISHING
// =====================================================

export async function stopPublish() {

  if (!publisherRoom) {

    publisherTracks = [];

    return;
  }


  try {

    for (
      const track
      of publisherTracks
    ) {

      try {

        await publisherRoom
          .localParticipant
          .unpublishTrack(
            track
          );

      } catch (error) {

        console.warn(
          'Could not unpublish track:',
          error
        );
      }
    }


    await publisherRoom.disconnect();

  } catch (error) {

    console.warn(
      'Kamwenge Live publisher disconnect warning:',
      error
    );

  } finally {

    publisherRoom = null;
    publisherTracks = [];
  }
}


// =====================================================
// VIEWER
// =====================================================

export async function watchLiveStream(
  eventId,
  videoElement,
  onState = () => {}
) {

  if (!videoElement) {
    throw new Error(
      'Viewer video element was not found.'
    );
  }


  await stopWatching();


  const session =
    await requestToken(
      eventId,
      'viewer'
    );


  const room =
    new Room({

      /*
       * IMPORTANT:
       * Disable adaptive streaming for now.
       * This helps prevent the viewer from receiving
       * one frame and then appearing frozen.
       */

      adaptiveStream: false,
      dynacast: false
    });


  viewerRoom = room;


  // =====================================================
  // ATTACH REMOTE TRACK
  // =====================================================

  const attachTrack =
    async (
      track,
      participant = null
    ) => {

      console.log(
        'Kamwenge Live track received:',
        {
          kind: track.kind,
          source: track.source,
          participant:
            participant?.identity
        }
      );


      // =================================================
      // VIDEO
      // =================================================

      if (
        track.kind === Track.Kind.Video ||
        track.kind === 'video'
      ) {

        console.log(
          'Attaching LIVE video track...'
        );


        if (viewerVideoTrack) {

          try {

            viewerVideoTrack
              .detach(
                videoElement
              );

          } catch {}
        }


        viewerVideoTrack =
          track;


        /*
         * Attach LiveKit directly to the real
         * visible Kamwenge Live <video> element.
         */

        track.attach(
          videoElement
        );


        videoElement.autoplay =
          true;

        videoElement.playsInline =
          true;


        /*
         * IMPORTANT:
         *
         * Keep video muted because audio is handled
         * separately below.
         *
         * This also prevents browser autoplay rules
         * from blocking continuous video playback.
         */

        videoElement.muted =
          true;


        videoElement.style.display =
          'block';


        videoElement.removeAttribute(
          'poster'
        );


        try {

          await videoElement.play();

          console.log(
            'Kamwenge Live video is playing.'
          );

        } catch (error) {

          console.warn(
            'Viewer video playback warning:',
            error
          );
        }


        onState(
          'playing'
        );


        return;
      }


      // =================================================
      // AUDIO
      // =================================================

      if (
        track.kind === Track.Kind.Audio ||
        track.kind === 'audio'
      ) {

        console.log(
          'Attaching LIVE audio track...'
        );


        const audioElement =
          document.createElement(
            'audio'
          );


        audioElement.autoplay =
          true;

        audioElement.controls =
          false;

        audioElement.playsInline =
          true;

        audioElement.dataset
          .kamwengeLiveAudio =
          '1';

        audioElement.style.display =
          'none';


        document.body
          .appendChild(
            audioElement
          );


        track.attach(
          audioElement
        );


        viewerAudioTracks.push({
          track,
          element:
            audioElement
        });


        try {

          await audioElement.play();

        } catch (error) {

          console.warn(
            'Viewer audio autoplay blocked. Click or tap the page to enable sound.',
            error
          );
        }
      }
    };


  // =====================================================
  // TRACK SUBSCRIBED
  // =====================================================

  room.on(
    RoomEvent.TrackSubscribed,
    (
      track,
      publication,
      participant
    ) => {

      console.log(
        'Track subscribed:',
        participant?.identity,
        track.kind
      );


      attachTrack(
        track,
        participant
      );
    }
  );


  // =====================================================
  // TRACK UNSUBSCRIBED
  // =====================================================

  room.on(
    RoomEvent.TrackUnsubscribed,
    (
      track,
      publication,
      participant
    ) => {

      console.log(
        'Track unsubscribed:',
        participant?.identity,
        track.kind
      );


      try {
        track.detach();
      } catch {}


      if (
        track ===
        viewerVideoTrack
      ) {

        viewerVideoTrack = null;

        videoElement.srcObject =
          null;

        onState(
          'reconnecting'
        );
      }
    }
  );


  // =====================================================
  // PARTICIPANTS
  // =====================================================

  room.on(
    RoomEvent.ParticipantConnected,
    participant => {

      console.log(
        'Participant connected:',
        participant.identity
      );
    }
  );


  room.on(
    RoomEvent.ParticipantDisconnected,
    participant => {

      console.log(
        'Participant disconnected:',
        participant.identity
      );
    }
  );


  // =====================================================
  // CONNECTION STATUS
  // =====================================================

  room.on(
    RoomEvent.Reconnecting,
    () => {

      console.log(
        'Kamwenge Live viewer reconnecting...'
      );

      onState(
        'reconnecting'
      );
    }
  );


  room.on(
    RoomEvent.Reconnected,
    () => {

      console.log(
        'Kamwenge Live viewer reconnected.'
      );

      onState(
        'connected'
      );
    }
  );


  room.on(
    RoomEvent.Disconnected,
    () => {

      console.log(
        'Kamwenge Live viewer disconnected.'
      );

      onState(
        'disconnected'
      );
    }
  );


  // =====================================================
  // CONNECT VIEWER
  // =====================================================

  await room.connect(
    session.wsUrl,
    session.token
  );


  console.log(
    'Kamwenge Live viewer connected to room:',
    eventId
  );


  onState(
    'connected'
  );


  // =====================================================
  // CHECK ALREADY-PUBLISHED TRACKS
  // =====================================================

  room.remoteParticipants
    .forEach(
      participant => {

        participant
          .trackPublications
          .forEach(
            publication => {

              console.log(
                'Existing remote publication:',
                publication.kind,
                publication.isSubscribed
              );


              if (
                publication.track
              ) {

                attachTrack(
                  publication.track,
                  participant
                );
              }
            }
          );
      }
    );


  return room;
}


// =====================================================
// STOP WATCHING
// =====================================================

export async function stopWatching() {

  // =====================================================
  // VIDEO CLEANUP
  // =====================================================

  if (viewerVideoTrack) {

    try {

      viewerVideoTrack.detach();

    } catch {}


    viewerVideoTrack = null;
  }


  // =====================================================
  // AUDIO CLEANUP
  // =====================================================

  for (
    const item
    of viewerAudioTracks
  ) {

    try {

      item.track.detach(
        item.element
      );

    } catch {}


    try {

      item.element.pause();

      item.element.srcObject =
        null;

      item.element.remove();

    } catch {}
  }


  viewerAudioTracks = [];


  document
    .querySelectorAll(
      'audio[data-kamwenge-live-audio="1"]'
    )
    .forEach(
      element => {

        try {

          element.pause();

          element.srcObject =
            null;

          element.remove();

        } catch {}
      }
    );


  // =====================================================
  // VIEWER ROOM CLEANUP
  // =====================================================

  if (viewerRoom) {

    try {

      await viewerRoom.disconnect();

    } catch (error) {

      console.warn(
        'Viewer disconnect warning:',
        error
      );
    }


    viewerRoom = null;
  }
}