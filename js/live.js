import {
  watchMeeting,
  watchComments,
  addComment,
  react,
  watchReactions,
  asDate,
  getPublicProfile
} from './store.js';

import {
  watchLiveStream,
  stopWatching
} from './streaming-adapter.js';

import {
  escapeHTML,
  formatDate,
  toast
} from './app.js';


// =====================================================
// CONFIG
// =====================================================

const SHARE_WORKER =
  'https://rwamwanja-kamwenge-live.tumwekwaseamiim.workers.dev';


// =====================================================
// EVENT ID
// =====================================================

const id =
  new URLSearchParams(
    location.search
  ).get('event');


const avatar =
  'assets/images/avatar-placeholder.svg';


let meeting = null;

let commentsUnsub =
  () => {};

let reactionUnsub =
  () => {};

let watchingEventId =
  null;


// =====================================================
// ELEMENTS
// =====================================================

const els = {

  title:
    document.querySelector(
      '#event-title'
    ),

  host:
    document.querySelector(
      '#event-host'
    ),

  hostPhoto:
    document.querySelector(
      '#event-host-photo'
    ),

  hostBio:
    document.querySelector(
      '#event-host-bio'
    ),

  date:
    document.querySelector(
      '#event-date'
    ),

  status:
    document.querySelector(
      '#event-status'
    ),

  countdown:
    document.querySelector(
      '#countdown'
    ),

  pre:
    document.querySelector(
      '#pre-live'
    ),

  live:
    document.querySelector(
      '#live-stage'
    ),

  ended:
    document.querySelector(
      '#ended-stage'
    ),

  comments:
    document.querySelector(
      '#comments'
    ),

  compose:
    document.querySelector(
      '#comment-form'
    ),

  video:
    document.querySelector(
      '#viewer-video'
    ),

  placeholder:
    document.querySelector(
      '#viewer-placeholder'
    ),

  reactions:
    document.querySelector(
      '#reaction-row'
    ),

  share:
    document.querySelector(
      '#share-event'
    )
};


// =====================================================
// COUNTDOWN
// =====================================================

function diffText(date) {

  let seconds =
    Math.max(
      0,
      Math.floor(
        (
          date -
          Date.now()
        ) / 1000
      )
    );


  const days =
    Math.floor(
      seconds / 86400
    );


  seconds %=
    86400;


  const hours =
    Math.floor(
      seconds / 3600
    );


  seconds %=
    3600;


  const minutes =
    Math.floor(
      seconds / 60
    );


  const secs =
    seconds % 60;


  return (
    `${days ? String(days).padStart(2, '0') + ':' : ''}` +
    `${String(hours).padStart(2, '0')}:` +
    `${String(minutes).padStart(2, '0')}:` +
    `${String(secs).padStart(2, '0')}`
  );
}


// =====================================================
// LIVE VIDEO
// =====================================================

async function ensureWatching(m) {

  if (
    m.status !==
    'live'
  ) {

    if (
      watchingEventId
    ) {

      await stopWatching()
        .catch(
          () => {}
        );


      watchingEventId =
        null;
    }


    return;
  }


  if (
    watchingEventId ===
    m.id
  ) {

    return;
  }


  watchingEventId =
    m.id;


  if (
    els.placeholder
  ) {

    els.placeholder
      .classList
      .remove(
        'hidden'
      );


    const heading =
      els.placeholder
        .querySelector(
          'h2'
        );


    const paragraph =
      els.placeholder
        .querySelector(
          'p'
        );


    if (heading) {

      heading.textContent =
        'Connecting to live video…';
    }


    if (paragraph) {

      paragraph.textContent =
        'The broadcaster is live. Video will start automatically.';
    }
  }


  try {

    await watchLiveStream(
      m.id,
      els.video,

      state => {

        if (
          state ===
          'playing'
        ) {

          els.placeholder
            ?.classList
            .add(
              'hidden'
            );
        }


        if (
          state ===
          'reconnecting'
        ) {

          els.placeholder
            ?.classList
            .remove(
              'hidden'
            );


          const heading =
            els.placeholder
              ?.querySelector(
                'h2'
              );


          if (heading) {

            heading.textContent =
              'Reconnecting…';
          }
        }


        if (
          state ===
          'disconnected'
        ) {

          els.placeholder
            ?.classList
            .remove(
              'hidden'
            );
        }
      }
    );


  } catch (error) {

    watchingEventId =
      null;


    els.placeholder
      ?.classList
      .remove(
        'hidden'
      );


    const heading =
      els.placeholder
        ?.querySelector(
          'h2'
        );


    const paragraph =
      els.placeholder
        ?.querySelector(
          'p'
        );


    if (heading) {

      heading.textContent =
        'Live video unavailable';
    }


    if (paragraph) {

      paragraph.textContent =
        error.message;
    }
  }
}


// =====================================================
// RENDER EVENT
// =====================================================

async function render(m) {

  meeting =
    m;


  if (!m) {

    if (els.title) {

      els.title.textContent =
        'Event not found';
    }


    return;
  }


  // ===================================================
  // BASIC EVENT DETAILS
  // ===================================================

  if (els.title) {

    els.title.textContent =
      m.title ||
      'Kamwenge Live Event';
  }


  if (els.host) {

    els.host.textContent =
      m.hostName ||
      'Broadcaster';
  }


  const miniHost =
    document.querySelector(
      '#event-host-mini'
    );


  if (miniHost) {

    miniHost.textContent =
      m.hostName ||
      'Broadcaster';
  }


  if (els.hostPhoto) {

    els.hostPhoto.src =
      m.hostPhotoURL ||
      avatar;
  }


  if (els.date) {

    els.date.textContent =
      formatDate(
        asDate(
          m.scheduledAt
        ) ||
        m.scheduledAt
      );
  }


  // ===================================================
  // PUBLIC BROADCASTER PROFILE
  // ===================================================

  const profile =
    await getPublicProfile(
      m.hostId
    )
      .catch(
        () => null
      );


  const displayName =
    profile?.displayName ||
    m.hostName ||
    'Broadcaster';


  if (els.host) {

    els.host.textContent =
      displayName;
  }


  if (miniHost) {

    miniHost.textContent =
      displayName;
  }


  if (els.hostPhoto) {

    els.hostPhoto.src =
      profile?.photoURL ||
      m.hostPhotoURL ||
      avatar;
  }


  if (els.hostBio) {

    els.hostBio.textContent =
      profile?.bio ||
      'Kamwenge Live broadcaster';
  }


  // ===================================================
  // EVENT STATE
  // ===================================================

  els.pre
    ?.classList
    .toggle(
      'hidden',
      m.status !==
      'scheduled'
    );


  els.live
    ?.classList
    .toggle(
      'hidden',
      m.status !==
      'live'
    );


  els.ended
    ?.classList
    .toggle(
      'hidden',
      m.status !==
      'ended'
    );


  if (els.status) {

    els.status.className =
      `badge ${
        m.status === 'live'
          ? 'badge-live'
          : m.status === 'ended'
            ? 'badge-ended'
            : 'badge-upcoming'
      }`;


    els.status.textContent =
      m.status === 'live'
        ? '🔴 LIVE NOW'
        : m.status === 'ended'
          ? '✅ ENDED'
          : '⏳ UPCOMING';
  }


  // ===================================================
  // LIVE VIDEO
  // ===================================================

  await ensureWatching(
    m
  );


  // ===================================================
  // COMMENTS
  // ===================================================

  if (
    m.commentsEnabled !==
    false
  ) {

    commentsUnsub();


    commentsUnsub =
      watchComments(
        m.id,
        renderComments
      );


  } else if (
    els.comments
  ) {

    els.comments.innerHTML =
      '<div class="muted center">Comments are disabled for this event.</div>';
  }


  // ===================================================
  // REACTIONS
  // ===================================================

  reactionUnsub();


  reactionUnsub =
    watchReactions(
      m.id,
      renderReactions
    );
}


// =====================================================
// COMMENTS
// =====================================================

function renderComments(
  comments
) {

  if (!els.comments) {
    return;
  }


  if (
    !comments.length
  ) {

    els.comments.innerHTML =
      '<div class="muted center">No comments yet. Start the discussion 💬</div>';


    return;
  }


  els.comments.innerHTML =
    comments
      .map(
        comment => {

          return `
            <div class="comment">

              <div class="comment-top">

                <span class="comment-name">
                  ${escapeHTML(
                    comment.name ||
                    'Guest'
                  )}
                </span>

              </div>

              <p>
                ${escapeHTML(
                  comment.text
                )}
              </p>

            </div>
          `;
        }
      )
      .join(
        ''
      );


  els.comments.scrollTop =
    els.comments.scrollHeight;
}


// =====================================================
// REACTIONS
// =====================================================

function renderReactions(
  counts
) {

  els.reactions
    ?.querySelectorAll(
      'button'
    )
    .forEach(
      button => {

        const emoji =
          button.dataset.emoji;


        const number =
          counts[
            encodeURIComponent(
              emoji
            )
          ] ||
          counts[
            emoji
          ] ||
          0;


        const span =
          button.querySelector(
            'span'
          );


        if (span) {

          span.textContent =
            number
              ? ` ${number}`
              : '';
        }
      }
    );
}


// =====================================================
// COMMENT SUBMIT
// =====================================================

els.compose
  ?.addEventListener(
    'submit',

    async event => {

      event.preventDefault();


      if (
        !meeting ||
        meeting.commentsEnabled ===
        false
      ) {

        return;
      }


      const name =
        document
          .querySelector(
            '#comment-name'
          )
          ?.value
          .trim() ||
        'Viewer';


      const input =
        document.querySelector(
          '#comment-text'
        );


      const text =
        input
          ?.value
          .trim();


      if (!text) {
        return;
      }


      try {

        await addComment(
          meeting.id,
          {
            name,
            text
          }
        );


        input.value =
          '';


      } catch (error) {

        toast(
          error.message
        );
      }
    }
  );


// =====================================================
// REACTION CLICK
// =====================================================

els.reactions
  ?.addEventListener(
    'click',

    async event => {

      const button =
        event.target.closest(
          'button[data-emoji]'
        );


      if (
        !button ||
        !meeting
      ) {

        return;
      }


      try {

        await react(
          meeting.id,
          button.dataset.emoji
        );


        button.animate(
          [
            {
              transform:
                'scale(1)'
            },

            {
              transform:
                'scale(1.18)'
            },

            {
              transform:
                'scale(1)'
            }
          ],

          {
            duration:
              240
          }
        );


      } catch (error) {

        toast(
          error.message
        );
      }
    }
  );


// =====================================================
// SHARE URL
// =====================================================

function buildShareURL() {

  if (!id) {

    return SHARE_WORKER;
  }


  return (
    `${SHARE_WORKER}/?event=` +
    encodeURIComponent(
      id
    )
  );
}


// =====================================================
// SHARE TEXT
// =====================================================

function buildShareText() {

  const title =
    meeting?.title ||
    'Kamwenge Live Event';


  const host =
    els.host
      ?.textContent
      ?.trim() ||
    meeting?.hostName ||
    'Broadcaster';


  const date =
    els.date
      ?.textContent
      ?.trim() ||
    '';


  let text =
    `🔴 ${title}`;


  if (date) {

    text +=
      `\n📅 ${date}`;
  }


  if (host) {

    text +=
      `\n🎙️ ${host}`;
  }


  text +=
    '\n\nWatch on Kamwenge Live™';


  return text;
}


// =====================================================
// COPY SHARE LINK
// =====================================================

async function copyShareLink(
  shareURL
) {

  try {

    await navigator.clipboard
      .writeText(
        shareURL
      );


    toast(
      'Event share link copied 🔗'
    );


    return;

  } catch {}


  // Older browser fallback

  const textarea =
    document.createElement(
      'textarea'
    );


  textarea.value =
    shareURL;


  textarea.style.position =
    'fixed';

  textarea.style.opacity =
    '0';


  document.body
    .appendChild(
      textarea
    );


  textarea.select();


  try {

    document.execCommand(
      'copy'
    );


    toast(
      'Event share link copied 🔗'
    );


  } catch {

    window.prompt(
      'Copy this Kamwenge Live event link:',
      shareURL
    );
  }


  textarea.remove();
}


// =====================================================
// SHARE EVENT
// =====================================================

els.share
  ?.addEventListener(
    'click',

    async () => {

      if (!id) {

        toast(
          'Event link is missing.'
        );


        return;
      }


      const shareURL =
        buildShareURL();


      const title =
        meeting?.title ||
        'Kamwenge Live Event';


      const shareData = {

        title:
          `${title} • Kamwenge Live™`,

        text:
          buildShareText(),

        url:
          shareURL
      };


      // =================================================
      // NATIVE PHONE SHARE MENU
      // =================================================

      if (
        navigator.share
      ) {

        try {

          await navigator.share(
            shareData
          );


          return;

        } catch (error) {

          if (
            error?.name ===
            'AbortError'
          ) {

            return;
          }


          console.warn(
            'Native share failed:',
            error
          );
        }
      }


      // =================================================
      // DESKTOP FALLBACK
      // =================================================

      await copyShareLink(
        shareURL
      );
    }
  );


// =====================================================
// COUNTDOWN TIMER
// =====================================================

setInterval(
  () => {

    if (
      meeting?.status ===
      'scheduled'
    ) {

      const date =
        asDate(
          meeting.scheduledAt
        ) ||
        new Date(
          meeting.scheduledAt
        );


      if (
        date &&
        els.countdown
      ) {

        els.countdown.textContent =
          diffText(
            date
          );
      }
    }
  },

  1000
);


// =====================================================
// PAGE CLEANUP
// =====================================================

window.addEventListener(
  'pagehide',

  () => {

    stopWatching()
      .catch(
        () => {}
      );
  }
);


// =====================================================
// START EVENT WATCHER
// =====================================================

if (id) {

  try {

    watchMeeting(
      id,
      render,

      error => {

        toast(
          error.message
        );
      }
    );


  } catch (error) {

    toast(
      error.message
    );
  }


} else if (
  els.title
) {

  els.title.textContent =
    'Event link is missing';
}