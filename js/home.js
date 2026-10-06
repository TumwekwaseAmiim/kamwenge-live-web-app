import {
  watchMeetings,
  asDate
} from './store.js';

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
// PUBLIC HOME SECTIONS
// =====================================================

const sections = {

  live:
    document.querySelector(
      '#live-grid'
    ),

  scheduled:
    document.querySelector(
      '#upcoming-grid'
    )
};


// =====================================================
// DEFAULT AVATAR
// =====================================================

const avatar =
  'assets/images/avatar-placeholder.svg';


// =====================================================
// BUILD EVENT SHARE URL
// =====================================================

function getShareURL(
  eventId
) {

  return (
    `${SHARE_WORKER}/?event=` +
    encodeURIComponent(
      eventId
    )
  );
}


// =====================================================
// EVENT CARD
// =====================================================

function card(m) {

  const isLive =
    m.status ===
    'live';


  const status =
    isLive
      ? '🔴 LIVE'
      : '⏳ UPCOMING';


  const badgeClass =
    isLive
      ? 'badge-live'
      : 'badge-upcoming';


  const action =
    isLive
      ? 'Watch Live'
      : 'View Countdown';


  const eventURL =
    `live.html?event=${encodeURIComponent(m.id)}`;


  const shareURL =
    getShareURL(
      m.id
    );


  return `
    <article class="card event-card">

      <div class="event-card-banner">

        <span>
          📡 KAMWENGE LIVE™
        </span>

      </div>


      <div class="card-body">

        <div class="event-meta">

          <span class="badge ${badgeClass}">
            ${status}
          </span>

        </div>


        <h3>
          ${escapeHTML(
            m.title ||
            'Kamwenge Live Event'
          )}
        </h3>


        <div class="host-row">

          <img
            class="host-avatar"
            src="${escapeHTML(
              m.hostPhotoURL ||
              avatar
            )}"
            alt="${escapeHTML(
              m.hostName ||
              'Broadcaster'
            )}"
            onerror="this.src='${avatar}'"
          >


          <div>

            <strong>
              ${escapeHTML(
                m.hostName ||
                'Broadcaster'
              )}
            </strong>


            <span>
              ${formatDate(
                asDate(
                  m.scheduledAt
                ) ||
                m.scheduledAt
              )}
            </span>

          </div>

        </div>

      </div>


      <div class="event-footer">

        <a
          class="btn ${
            isLive
              ? 'btn-live'
              : 'btn-soft'
          }"
          href="${eventURL}"
        >
          ${
            isLive
              ? '🔴 Watch Live'
              : '⏳ View Countdown'
          }
        </a>


        <button
          class="btn btn-light share"
          type="button"
          data-event-id="${escapeHTML(m.id)}"
          data-share-url="${escapeHTML(shareURL)}"
          data-title="${escapeHTML(
            m.title ||
            'Kamwenge Live Event'
          )}"
          data-host="${escapeHTML(
            m.hostName ||
            'Broadcaster'
          )}"
          data-date="${escapeHTML(
            formatDate(
              asDate(
                m.scheduledAt
              ) ||
              m.scheduledAt
            )
          )}"
        >
          🔗 Share
        </button>

      </div>

    </article>
  `;
}


// =====================================================
// EMPTY STATE
// =====================================================

function emptyState(
  status
) {

  if (
    status ===
    'live'
  ) {

    return `
      <div class="empty-state">

        <div class="emoji">
          📡
        </div>

        <strong>
          No live broadcasts right now.
        </strong>

        <p class="muted">
          Upcoming events will appear below.
        </p>

      </div>
    `;
  }


  return `
    <div class="empty-state">

      <div class="emoji">
        🗓️
      </div>

      <strong>
        No upcoming events right now.
      </strong>

      <p class="muted">
        New scheduled broadcasts will appear here.
      </p>

    </div>
  `;
}


// =====================================================
// RENDER HOMEPAGE
// =====================================================

function render(
  all
) {

  // -----------------------------------------------------
  // Only public statuses:
  // LIVE
  // SCHEDULED
  //
  // ENDED events stay in Firestore but are not shown.
  // -----------------------------------------------------

  Object.entries(
    sections
  )
    .forEach(
      (
        [
          status,
          element
        ]
      ) => {

        if (!element) {
          return;
        }


        const items =
          all
            .filter(
              meeting =>
                meeting.status ===
                status
            );


        // -------------------------------------------------
        // SORT EVENTS
        // -------------------------------------------------

        if (
          status ===
          'scheduled'
        ) {

          /*
           * Upcoming:
           * nearest event first
           */

          items.sort(
            (
              a,
              b
            ) => {

              const dateA =
                asDate(
                  a.scheduledAt
                );


              const dateB =
                asDate(
                  b.scheduledAt
                );


              return (
                dateA?.getTime?.() ||
                0
              ) - (
                dateB?.getTime?.() ||
                0
              );
            }
          );

        } else {

          /*
           * Live:
           * newest live event first
           */

          items.sort(
            (
              a,
              b
            ) => {

              const dateA =
                asDate(
                  a.scheduledAt
                );


              const dateB =
                asDate(
                  b.scheduledAt
                );


              return (
                dateB?.getTime?.() ||
                0
              ) - (
                dateA?.getTime?.() ||
                0
              );
            }
          );
        }


        element.innerHTML =
          items.length
            ? items
                .map(
                  card
                )
                .join(
                  ''
                )
            : emptyState(
                status
              );
      }
    );


  // =====================================================
  // SHARE BUTTONS
  // =====================================================

  document
    .querySelectorAll(
      '.share'
    )
    .forEach(
      button => {

        button.onclick =
          async () => {

            const shareURL =
              button.dataset
                .shareUrl;


            const title =
              button.dataset
                .title ||
              'Kamwenge Live Event';


            const host =
              button.dataset
                .host ||
              'Broadcaster';


            const date =
              button.dataset
                .date ||
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


            try {

              if (
                navigator.share
              ) {

                await navigator.share(
                  {
                    title:
                      `${title} • Kamwenge Live™`,

                    text,

                    url:
                      shareURL
                  }
                );


              } else {

                await navigator
                  .clipboard
                  .writeText(
                    shareURL
                  );


                toast(
                  'Event share link copied 🔗'
                );
              }


            } catch (
              error
            ) {

              if (
                error?.name ===
                'AbortError'
              ) {

                return;
              }


              console.warn(
                'Share failed:',
                error
              );


              try {

                await navigator
                  .clipboard
                  .writeText(
                    shareURL
                  );


                toast(
                  'Event share link copied 🔗'
                );

              } catch {

                window.prompt(
                  'Copy this event link:',
                  shareURL
                );
              }
            }
          };
      }
    );
}


// =====================================================
// FIRESTORE WATCHER
// =====================================================

try {

  watchMeetings(

    render,

    error => {

      console.error(
        'Kamwenge Live meeting watcher error:',
        error
      );


      Object
        .values(
          sections
        )
        .forEach(
          element => {

            if (!element) {
              return;
            }


            element.innerHTML =
              `
                <div class="empty-state">

                  <div class="emoji">
                    ⚠️
                  </div>

                  <strong>
                    Events could not be loaded.
                  </strong>

                  <p class="muted">
                    Please check your internet connection
                    and try again.
                  </p>

                </div>
              `;
          }
        );
    }
  );


} catch (
  error
) {

  console.error(
    error
  );


  render(
    []
  );


  toast(
    error.message
  );
}